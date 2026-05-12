/**
 * Result Service — Pure business logic for result publishing and leaderboard.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Audit context (ip, userAgent) passed as a separate object.
 *   - Side effects (email, audit) are fire-and-forget but logged on failure.
 */

import { prisma } from "../db";
import { writeAuditEvent } from "../lib/audit";
import { sendResultPublishedEmail, batchSendEmails } from "../lib/email";
import { countryToLocale } from "../lib/constants";
import { getScoringPreset } from "../lib/scoringPresets";
import { scoreMatchPick } from "../lib/scoringAdvanced";
import type { PhasePickConfig } from "../types/pickConfig";
import {
  validateCanAutoAdvance,
  advanceToRoundOf32,
  advanceKnockoutPhase,
} from "../services/instanceAdvancement";
import { transitionToCompleted, canPublishResults } from "../services/poolStateMachine";
import { ResultSource, ResultSourceMode } from "@prisma/client";
import { requirePoolAdmin } from "../lib/roles";
import {
  extractMatches,
  extractTeams,
  parseFixtureData,
  typed,
  type FixtureMatch,
  type PickJson,
} from "../lib/fixture";
import { outcomeFromScore } from "../lib/poolHelpers";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Types ───────────────────────────────────────────────────

export type PublishResultInput = {
  poolId: string;
  matchId: string;
  userId: string;
  homeGoals: number;
  awayGoals: number;
  homeGoals90?: number;
  awayGoals90?: number;
  homePenalties?: number;
  awayPenalties?: number;
  reason?: string;
};

export type SendResultNotificationsInput = {
  poolId: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  pool: {
    name: string;
    scoringPresetKey: string;
    pickTypesConfig?: unknown;
    tournamentInstance: { dataJson: unknown };
  };
  match: FixtureMatch;
};

export type HandleAutoAdvanceInput = {
  poolId: string;
  matchId: string;
  userId: string;
  pool: {
    tournamentInstance: { id: string; dataJson: unknown };
  };
};

// ─── publishResult ───────────────────────────────────────────

export async function publishResult(data: PublishResultInput, ctx: AuditContext) {
  const { poolId, matchId, userId, homeGoals, awayGoals, homeGoals90, awayGoals90, homePenalties, awayPenalties, reason } = data;

  // 1) Authorization
  const isAdmin = await requirePoolAdmin(userId, poolId);
  if (!isAdmin) throw new ServiceError("FORBIDDEN", 403);

  // 2) Pool validation
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  if (!canPublishResults(pool.status)) {
    throw new ServiceError("CONFLICT", 409, { message: "Cannot publish results in this pool status" });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    throw new ServiceError("CONFLICT", 409, { message: "TournamentInstance is ARCHIVED" });
  }

  // 3) Match lookup from fixture data
  const matches = extractMatches(pool.tournamentInstance.dataJson);
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new ServiceError("NOT_FOUND", 404, { message: "Match not found in instance snapshot" });

  // 4) Determine result source mode
  const instanceResultSourceMode = pool.tournamentInstance.resultSourceMode as ResultSourceMode;

  // 5) Transaction with FOR UPDATE locking
  let resolvedSource: ResultSource = "HOST_MANUAL"; // will be set inside tx
  const saved = await prisma.$transaction(async (tx) => {
    // header (poolId+matchId) — lock row to serialize concurrent publications
    let header = await tx.poolMatchResult.findUnique({ where: { poolId_matchId: { poolId, matchId } } });
    if (header) {
      await tx.$queryRaw`SELECT id FROM "PoolMatchResult" WHERE id = ${header.id} FOR UPDATE`;
    } else {
      header = await tx.poolMatchResult.create({ data: { poolId, matchId } });
    }

    // siguiente versionNumber y última versión (safe after row lock)
    const last = await tx.poolMatchResultVersion.findFirst({
      where: { resultId: header.id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (last?.versionNumber ?? 0) + 1;

    // Determinar el source según el modo de la instancia y el estado actual
    let source: ResultSource;

    if (instanceResultSourceMode === "MANUAL") {
      // Legacy: instancias manuales permiten publicación directa
      source = last ? "HOST_OVERRIDE" : "HOST_MANUAL";
    } else {
      // AUTO mode: el host SOLO puede hacer override de resultados existentes
      if (!last) {
        throw new ServiceError("RESULT_NOT_YET_AVAILABLE", 403, {
          message: "Results are published automatically by the API. You can only modify a result after it has been published.",
        });
      }
      source = "HOST_OVERRIDE";
    }
    resolvedSource = source;

    // Override siempre requiere justificación
    if (source === "HOST_OVERRIDE" && !reason) {
      throw new ServiceError("REASON_REQUIRED_FOR_OVERRIDE", 400, {
        message: "A reason is required when modifying a result. All participants will be notified.",
      });
    }

    // crear versión con source
    const version = await tx.poolMatchResultVersion.create({
      data: {
        resultId: header.id,
        versionNumber: nextVersion,
        status: "PUBLISHED",
        homeGoals,
        awayGoals,
        homeGoals90: homeGoals90 ?? null,
        awayGoals90: awayGoals90 ?? null,
        homePenalties: homePenalties ?? null,
        awayPenalties: awayPenalties ?? null,
        reason: reason ?? null,
        createdByUserId: userId,
        source,
      },
    });

    // apuntar currentVersion
    const updatedHeader = await tx.poolMatchResult.update({
      where: { id: header.id },
      data: { currentVersionId: version.id },
      include: { currentVersion: true },
    });

    return updatedHeader;
  });

  // 6) Fire-and-forget: audit event
  fireAndForget("audit RESULT_PUBLISHED", writeAuditEvent({
    actorUserId: userId,
    action: "RESULT_PUBLISHED",
    entityType: "PoolMatchResult",
    entityId: saved.id,
    dataJson: { poolId, matchId, currentVersionId: saved.currentVersionId },
    ip: ctx.ip,
    userAgent: ctx.userAgent ?? null,
  }));

  // Auto-publish structural results (Estratega) if the host override
  // affects a structural phase. The score-based path is a no-op
  // (autoPublishStructuralResults bails when requiresScore !== false).
  // Lazy import to keep the existing module-graph dependency direction
  // consistent with the advancement trigger below.
  fireAndForget(
    "auto-publish-structural-after-publish",
    import("./structuralAutoPublish").then((m) =>
      m.autoPublishStructuralResults(poolId, matchId)
    )
  );

  // Trigger automatic phase advancement check (delayed)
  fireAndForget(
    "advancement-trigger-after-publish",
    import("./advancementTrigger").then((m) =>
      m.checkAndTriggerAdvancement(poolId, matchId, userId)
    )
  );

  return { saved, pool, match, source: resolvedSource };
}

// ─── sendResultNotifications ─────────────────────────────────

export async function sendResultNotifications(data: SendResultNotificationsInput): Promise<void> {
  try {
    const { poolId, matchId, homeGoals, awayGoals, pool, match } = data;

    // Obtener equipos del partido
    const teams = extractTeams(pool.tournamentInstance.dataJson);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);
    const allMatches = extractMatches(pool.tournamentInstance.dataJson);

    const matchDescription = `${homeTeam?.name ?? "Local"} vs ${awayTeam?.name ?? "Visitante"}`;
    const resultText = `${homeGoals} - ${awayGoals}`;

    // Obtener miembros activos del pool
    const members = await prisma.poolMember.findMany({
      where: { poolId, status: "ACTIVE" },
      include: { user: { select: { id: true, email: true, displayName: true, country: true } } },
      orderBy: { joinedAtUtc: "asc" },
    });

    // Obtener picks de este partido
    const matchPicks = await prisma.prediction.findMany({
      where: { poolId, matchId },
    });
    const pickByUserId = new Map(matchPicks.map((p) => [p.userId, p]));

    // Obtener todos los resultados para calcular ranking
    const allResults = await prisma.poolMatchResult.findMany({
      where: { poolId },
      include: { currentVersion: true },
    });
    const resultByMatchId = new Map<string, {
      homeGoals: number; awayGoals: number;
      homeGoals90?: number | null; awayGoals90?: number | null;
    }>();
    for (const r of allResults) {
      if (r.currentVersion) {
        resultByMatchId.set(r.matchId, {
          homeGoals: r.currentVersion.homeGoals,
          awayGoals: r.currentVersion.awayGoals,
          homeGoals90: r.currentVersion.homeGoals90,
          awayGoals90: r.currentVersion.awayGoals90,
        });
      }
    }

    // Obtener todas las predicciones para calcular ranking
    const allPredictions = await prisma.prediction.findMany({
      where: { poolId, matchId: { in: allMatches.map((m) => m.id) } },
    });

    // Detect advanced scoring mode
    const pickTypesConfig = Array.isArray(pool.pickTypesConfig)
      ? (pool.pickTypesConfig as PhasePickConfig[])
      : null;
    const matchById = new Map(allMatches.map((m) => [m.id, m]));

    const preset = getScoringPreset(pool.scoringPresetKey);

    function scoreLegacy(pick: PickJson | null | undefined, res: { homeGoals: number; awayGoals: number }): number {
      if (!pick) return 0;
      const actual = outcomeFromScore(res.homeGoals, res.awayGoals);
      if (pick.type === "OUTCOME") {
        return pick.outcome === actual ? preset.outcomePoints : 0;
      }
      if (pick.type === "SCORE") {
        const predicted = outcomeFromScore(pick.homeGoals!, pick.awayGoals!);
        if (predicted !== actual) return 0;
        let pts = preset.outcomePoints;
        if (preset.allowScorePick && pick.homeGoals === res.homeGoals && pick.awayGoals === res.awayGoals) {
          pts += preset.exactScoreBonus;
        }
        return pts;
      }
      return 0;
    }

    function scoreAdvanced(
      pick: PickJson | null | undefined,
      res: { homeGoals: number; awayGoals: number; homeGoals90?: number | null; awayGoals90?: number | null },
      phaseConfig: PhasePickConfig,
    ): number {
      if (!pick || pick.type !== "SCORE" || typeof pick.homeGoals !== "number" || typeof pick.awayGoals !== "number") {
        return scoreLegacy(pick, res);
      }
      if (!phaseConfig.requiresScore || !phaseConfig.matchPicks) {
        return scoreLegacy(pick, res);
      }
      try {
        const resultForScoring = {
          homeGoals: phaseConfig.includeExtraTime ? res.homeGoals : (res.homeGoals90 ?? res.homeGoals),
          awayGoals: phaseConfig.includeExtraTime ? res.awayGoals : (res.awayGoals90 ?? res.awayGoals),
        };
        return scoreMatchPick(
          { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
          resultForScoring,
          phaseConfig,
        ).totalPoints;
      } catch {
        return scoreLegacy(pick, res);
      }
    }

    // Calcular puntos por usuario
    const userPoints = new Map<string, number>();
    for (const pred of allPredictions) {
      const result = resultByMatchId.get(pred.matchId);
      if (!result) continue;
      const pick = typed<PickJson>(pred.pickJson);
      const predMatch = matchById.get(pred.matchId);
      const phaseConfig = pickTypesConfig && predMatch
        ? pickTypesConfig.find((p) => p.phaseId === predMatch.phaseId)
        : null;

      const pts = phaseConfig
        ? scoreAdvanced(pick, result, phaseConfig)
        : scoreLegacy(pick, result);
      userPoints.set(pred.userId, (userPoints.get(pred.userId) ?? 0) + pts);
    }

    // Ordenar para ranking
    const sortedMembers = members
      .map((m) => ({ ...m, totalPoints: userPoints.get(m.userId) ?? 0 }))
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return new Date(a.joinedAtUtc).getTime() - new Date(b.joinedAtUtc).getTime();
      });

    // Calcular puntos ganados en este partido por usuario
    const currentMatchResult = resultByMatchId.get(matchId) ?? { homeGoals, awayGoals };
    const currentMatchPhaseConfig = pickTypesConfig
      ? pickTypesConfig.find((p) => p.phaseId === match.phaseId)
      : null;

    // Enviar emails (batched to avoid hitting Resend rate limits)
    const emailItems = sortedMembers.map((member, idx) => {
      const pick = pickByUserId.get(member.userId);
      const pickJson = pick ? typed<PickJson>(pick.pickJson) : null;
      const pointsEarned = currentMatchPhaseConfig
        ? scoreAdvanced(pickJson, currentMatchResult, currentMatchPhaseConfig)
        : scoreLegacy(pickJson, currentMatchResult);
      return { member, pointsEarned, rank: idx + 1 };
    });

    await batchSendEmails(emailItems, (item) =>
      sendResultPublishedEmail({
        to: item.member.user.email,
        userId: item.member.user.id,
        displayName: item.member.user.displayName,
        poolName: pool.name,
        poolId,
        matchDescription,
        result: resultText,
        pointsEarned: item.pointsEarned,
        currentRank: item.rank,
        totalParticipants: sortedMembers.length,
        locale: countryToLocale(item.member.user.country),
      }),
    );
  } catch (emailError) {
    console.error("Error sending result notification emails:", emailError);
  }
}

// ─── handleAutoAdvance ───────────────────────────────────────

export async function handleAutoAdvance(data: HandleAutoAdvanceInput, ctx: AuditContext): Promise<void> {
  try {
    const { poolId, matchId, userId, pool } = data;
    const fixtureData = parseFixtureData(pool.tournamentInstance.dataJson);

    if (fixtureData.phases.length === 0 || fixtureData.matches.length === 0) {
      return; // No hay fases definidas, skip auto-advance
    }

    // Encontrar la fase del partido que acabamos de actualizar
    const updatedMatch = fixtureData.matches.find((m) => m.id === matchId);
    if (!updatedMatch) return;

    const phaseId = updatedMatch.phaseId;
    if (!phaseId) return;

    // Validar si podemos hacer auto-advance para esta fase
    const validation = await validateCanAutoAdvance(
      pool.tournamentInstance.id,
      phaseId,
      poolId,
    );

    if (!validation.canAdvance) {
      console.log(`[AUTO-ADVANCE BLOCKED] Phase: ${phaseId}, Reason: ${validation.reason}`);
      return;
    }

    // Fase completa y sin bloqueos — proceder con auto-advance
    console.log(`[AUTO-ADVANCE] Phase ${phaseId} complete. Advancing...`);

    if (phaseId === "group_stage") {
      // Avanzar de Grupos a Round of 32
      const result = await advanceToRoundOf32(pool.tournamentInstance.id, poolId);

      fireAndForget("audit TOURNAMENT_AUTO_ADVANCED_TO_R32", writeAuditEvent({
        actorUserId: userId,
        action: "TOURNAMENT_AUTO_ADVANCED_TO_R32",
        entityType: "TournamentInstance",
        entityId: pool.tournamentInstance.id,
        dataJson: {
          triggeredBy: "RESULT_PUBLISH",
          matchId,
          winnersCount: result.winners.size,
          runnersUpCount: result.runnersUp.size,
          bestThirdsCount: result.bestThirds.length,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent ?? null,
      }));

      console.log(`[AUTO-ADVANCE SUCCESS] Advanced to Round of 32`);
    } else if (phaseId.startsWith("round_of_") || phaseId.includes("finals") || phaseId === "quarter_finals" || phaseId === "semi_finals") {
      // Avanzar fases knockout
      const phaseOrder: Record<string, string | null> = {
        round_of_32: "round_of_16",
        round_of_16: "quarter_finals",
        quarter_finals: "semi_finals",
        semi_finals: "finals",
        finals: null, // Torneo terminado
      };

      const nextPhaseId = phaseOrder[phaseId];
      if (nextPhaseId) {
        const result = await advanceKnockoutPhase(
          pool.tournamentInstance.id,
          phaseId,
          nextPhaseId,
          poolId,
        );

        fireAndForget("audit TOURNAMENT_AUTO_ADVANCED_KNOCKOUT", writeAuditEvent({
          actorUserId: userId,
          action: "TOURNAMENT_AUTO_ADVANCED_KNOCKOUT",
          entityType: "TournamentInstance",
          entityId: pool.tournamentInstance.id,
          dataJson: {
            triggeredBy: "RESULT_PUBLISH",
            matchId,
            from: phaseId,
            to: nextPhaseId,
            resolvedMatchesCount: result.resolvedMatches.length,
          },
          ip: ctx.ip,
          userAgent: ctx.userAgent ?? null,
        }));

        console.log(`[AUTO-ADVANCE SUCCESS] Advanced from ${phaseId} to ${nextPhaseId}`);
      } else {
        console.log(`[AUTO-ADVANCE] Tournament complete!`);
      }
    }

    // Verificar si todos los partidos tienen resultado → Pool COMPLETED
    try {
      await transitionToCompleted(poolId, userId);
    } catch (completedError: any) {
      console.error("[POOL COMPLETED ERROR]", completedError.message);
    }
  } catch (autoAdvanceError: any) {
    // Si falla el auto-advance, loguear pero NO fallar la request original
    console.error("[AUTO-ADVANCE ERROR]", autoAdvanceError.message);
  }
}

// ─── getLeaderboard ──────────────────────────────────────────

export async function getLeaderboard(poolId: string, userId: string, verbose: boolean) {
  // 1) Membership validation
  const m = await prisma.poolMember.findFirst({ where: { poolId, userId, status: "ACTIVE" } });
  if (!m) throw new ServiceError("FORBIDDEN", 403);

  // 2) Pool lookup
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404);

  // 3) Extract fixture data
  const matches = extractMatches(pool.tournamentInstance.dataJson);
  const teams = extractTeams(pool.tournamentInstance.dataJson);

  const matchById = new Map(matches.map((mt) => [mt.id, mt]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const matchIds = matches.map((mt) => mt.id);

  // 4) Fetch results
  const results = await prisma.poolMatchResult.findMany({
    where: { poolId },
    include: { currentVersion: true },
  });

  const resultByMatchId = new Map<string, { homeGoals: number; awayGoals: number }>();
  for (const r of results) {
    if (r.currentVersion) {
      resultByMatchId.set(r.matchId, {
        homeGoals: r.currentVersion.homeGoals,
        awayGoals: r.currentVersion.awayGoals,
      });
    }
  }

  // 5) Fetch members
  const members = await prisma.poolMember.findMany({
    where: { poolId, status: "ACTIVE" },
    include: { user: { select: { id: true, email: true, username: true, displayName: true } } },
    orderBy: { joinedAtUtc: "asc" },
  });

  // 6) Fetch predictions
  const predictions = await prisma.prediction.findMany({
    where: { poolId, matchId: { in: matchIds } },
  });

  const predsByUserMatch = new Map<string, Map<string, typeof predictions[number]>>();
  for (const p of predictions) {
    const byMatch = predsByUserMatch.get(p.userId) ?? new Map<string, typeof predictions[number]>();
    byMatch.set(p.matchId, p);
    predsByUserMatch.set(p.userId, byMatch);
  }

  // 7) Scoring helpers (kept identical to route)
  function outcomeFromScoreLocal(hg: number, ag: number): "HOME" | "DRAW" | "AWAY" {
    if (hg > ag) return "HOME";
    if (hg < ag) return "AWAY";
    return "DRAW";
  }

  function scorePickDetailed(pick: PickJson | null | undefined, actualHome: number, actualAway: number) {
    const actualOutcome = outcomeFromScoreLocal(actualHome, actualAway);

    if (pick?.type === "OUTCOME") {
      const isCorrect = pick.outcome === actualOutcome;
      return {
        pickType: "OUTCOME",
        outcomePoints: isCorrect ? 3 : 0,
        exactScoreBonus: 0,
        totalPoints: isCorrect ? 3 : 0,
        details: { predictedOutcome: pick.outcome, actualOutcome, isCorrect },
      };
    }

    if (pick?.type === "SCORE") {
      const predictedOutcome = outcomeFromScoreLocal(pick.homeGoals!, pick.awayGoals!);
      const outcomeCorrect = predictedOutcome === actualOutcome;
      const outcomePoints = outcomeCorrect ? 3 : 0;

      const exact = pick.homeGoals === actualHome && pick.awayGoals === actualAway;
      const exactScoreBonus = exact && outcomeCorrect ? 2 : 0;

      return {
        pickType: "SCORE",
        outcomePoints,
        exactScoreBonus,
        totalPoints: outcomePoints + exactScoreBonus,
        details: {
          predictedScore: { homeGoals: pick.homeGoals, awayGoals: pick.awayGoals },
          actualScore: { homeGoals: actualHome, awayGoals: actualAway },
          predictedOutcome,
          actualOutcome,
          outcomeCorrect,
          exact,
        },
      };
    }

    return {
      pickType: pick?.type ?? "UNKNOWN",
      outcomePoints: 0,
      exactScoreBonus: 0,
      totalPoints: 0,
      details: { message: "Pick type not supported in MVP scoring" },
    };
  }

  // 8) Build rows
  const rows = members.map((mb) => {
    let points = 0;
    let scoredMatches = 0;

    const byMatch = predsByUserMatch.get(mb.userId) ?? new Map<string, typeof predictions[number]>();
    const breakdown: Array<Record<string, unknown>> = [];

    for (const match of matches) {
      const pred = byMatch.get(match.id);
      const result = resultByMatchId.get(match.id);

      const homeTeam = teamById.get(match.homeTeamId);
      const awayTeam = teamById.get(match.awayTeamId);

      if (!result) {
        if (verbose) {
          breakdown.push({
            matchId: match.id,
            kickoffUtc: match.kickoffUtc,
            roundLabel: match.roundLabel ?? null,
            homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
            awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
            pick: pred?.pickJson ?? null,
            result: null,
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
            status: pred ? "PICKED_NO_RESULT" : "NO_PICK_NO_RESULT",
          });
        }
        continue;
      }

      if (!pred) {
        if (verbose) {
          breakdown.push({
            matchId: match.id,
            kickoffUtc: match.kickoffUtc,
            roundLabel: match.roundLabel ?? null,
            homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
            awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
            pick: null,
            result: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
            points: { outcomePoints: 0, exactScoreBonus: 0, totalPoints: 0 },
            status: "NO_PICK",
          });
        }
        continue;
      }

      const scored = scorePickDetailed(typed<PickJson>(pred.pickJson), result.homeGoals, result.awayGoals);
      points += scored.totalPoints;
      scoredMatches += 1;

      if (verbose) {
        breakdown.push({
          matchId: match.id,
          kickoffUtc: match.kickoffUtc,
          roundLabel: match.roundLabel ?? null,
          homeTeam: { id: match.homeTeamId, name: homeTeam?.name ?? null, code: homeTeam?.code ?? null },
          awayTeam: { id: match.awayTeamId, name: awayTeam?.name ?? null, code: awayTeam?.code ?? null },
          pick: pred.pickJson,
          result: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
          points: {
            outcomePoints: scored.outcomePoints,
            exactScoreBonus: scored.exactScoreBonus,
            totalPoints: scored.totalPoints,
          },
          status: "SCORED",
          details: scored.details,
        });
      }
    }

    return {
      userId: mb.userId,
      displayName: mb.user.displayName,
      role: mb.role,
      points,
      scoredMatches,
      joinedAtUtc: mb.joinedAtUtc,
      breakdown: verbose ? breakdown : undefined,
    };
  });

  // 9) Sort: points desc, joinedAt asc for ties
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    const aTime = a.joinedAtUtc instanceof Date ? a.joinedAtUtc.getTime() : new Date(a.joinedAtUtc).getTime();
    const bTime = b.joinedAtUtc instanceof Date ? b.joinedAtUtc.getTime() : new Date(b.joinedAtUtc).getTime();
    return aTime - bTime;
  });

  // 10) Return leaderboard data
  return {
    pool: { id: pool.id, name: pool.name },
    scoring: { outcomePoints: 3, exactScoreBonus: 2 },
    updatedAtUtc: new Date().toISOString(),
    verbose,
    leaderboard: rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      displayName: r.displayName,
      role: r.role,
      points: r.points,
      scoredMatches: r.scoredMatches,
      joinedAtUtc: r.joinedAtUtc,
      ...(verbose ? { breakdown: r.breakdown } : {}),
    })),
  };
}
