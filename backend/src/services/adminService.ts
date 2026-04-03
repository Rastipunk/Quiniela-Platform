/**
 * Admin Service — Pure business logic for platform admin operations.
 *
 * Rules:
 *   - No Express imports (no req/res/next).
 *   - Receives plain data, returns plain data or throws ServiceError.
 *   - Side effects (audit) are fire-and-forget but logged on failure.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";
import { ApiFootballClient } from "../services/apiFootball/client";
import { fireAndForget } from "../lib/asyncHelpers";
import { ServiceError, type AuditContext } from "./authService";

// ─── Platform Stats ──────────────────────────────────────────

export async function getPlatformStats() {
  const [totalUsers, testUsers, usersByMonth, totalPools, totalFeedback] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { email: { contains: "example.com" } } }),
    prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT to_char("createdAtUtc", 'YYYY-MM') AS month, COUNT(*)::bigint AS count
      FROM "User"
      WHERE email NOT LIKE '%example.com%'
      GROUP BY month
      ORDER BY month ASC
    `,
    prisma.pool.count(),
    prisma.betaFeedback.count(),
  ]);

  return {
    users: {
      total: totalUsers,
      test: testUsers,
      real: totalUsers - testUsers,
      byMonth: usersByMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
    },
    pools: { total: totalPools },
    feedback: { total: totalFeedback },
  };
}

// ─── Seed WC2026 ─────────────────────────────────────────────

export async function seedWc2026() {
  const existing = await prisma.tournamentInstance.findFirst({
    where: { name: "WC 2026 (Sandbox Instance)" },
  });

  if (existing) {
    return { message: "WC2026 ya existe", instanceId: existing.id };
  }

  const raw = buildWc2026SandboxData();
  const parsed = templateDataSchema.parse(raw);
  const issues = validateTemplateDataConsistency(parsed);
  if (issues.length) {
    throw new ServiceError(`TemplateData inconsistente: ${issues.join(", ")}`, 400);
  }

  const key = "wc_2026_sandbox";
  const templateName = "World Cup 2026 (Sandbox)";
  const instanceName = "WC 2026 (Sandbox Instance)";
  const now = new Date();

  const template = await prisma.tournamentTemplate.upsert({
    where: { key },
    update: { name: templateName, status: "PUBLISHED" },
    create: { key, name: templateName, status: "PUBLISHED" },
  });

  const last = await prisma.tournamentTemplateVersion.findFirst({
    where: { templateId: template.id },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

  const version = await prisma.tournamentTemplateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: nextVersionNumber,
      status: "PUBLISHED",
      publishedAtUtc: now,
      dataJson: parsed as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.tournamentTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id, status: "PUBLISHED" },
  });

  const instance = await prisma.tournamentInstance.create({
    data: {
      name: instanceName,
      status: "ACTIVE",
      templateId: template.id,
      templateVersionId: version.id,
      dataJson: parsed as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    message: "WC2026 Sandbox creado exitosamente",
    templateId: template.id,
    versionId: version.id,
    instanceId: instance.id,
  };
}

// ─── UCL R16 Update ──────────────────────────────────────────

const UCL_INSTANCE_ID = "ucl-2025-instance";
const UCL_VERSION_ID = "ucl-2025-version";

const API_TO_INTERNAL: Record<number, string> = {
  645: "t_GAL", 496: "t_JUV", 91: "t_MON", 85: "t_PSG",
  165: "t_BVB", 499: "t_ATA", 211: "t_BEN", 541: "t_RMA",
  556: "t_QAR", 34: "t_NEW", 327: "t_BOD", 505: "t_INT",
  553: "t_OLY", 168: "t_LEV", 569: "t_BRU", 530: "t_ATM",
  42: "t_ARS", 157: "t_BAY", 40: "t_LIV", 47: "t_TOT",
  529: "t_BAR", 49: "t_CHE", 228: "t_SPO", 50: "t_MCI",
};

interface UclMatchData {
  id: string; phaseId: string; kickoffUtc: string;
  homeTeamId: string; awayTeamId: string; matchNumber: number;
  label: string; tieNumber?: number; leg?: number;
  status: "SCHEDULED" | "PLACEHOLDER";
}

interface UclTemplateData {
  meta: any; teams: any[]; phases: any[]; matches: UclMatchData[]; advancement: any;
}

interface R16TieData {
  tieNumber: number; teamA: string; teamB: string;
  leg1: { fixtureId: number; kickoffUtc: string };
  leg2: { fixtureId: number; kickoffUtc: string };
}

function updateMatchesWithR16Data(data: UclTemplateData, r16Ties: R16TieData[]): UclTemplateData {
  const teamName = (id: string) => data.teams.find((t: any) => t.id === id)?.name ?? id;

  const updatedMatches = data.matches.map((match) => {
    if (match.status !== "PLACEHOLDER") return match;
    if (!match.phaseId.startsWith("r16_")) return match;
    const originalTieNumber = match.tieNumber;
    if (!originalTieNumber) return match;
    const tie = r16Ties.find((t) => t.tieNumber === originalTieNumber);
    if (!tie) return match;

    if (match.phaseId === "r16_leg1") {
      return { ...match, homeTeamId: tie.teamA, awayTeamId: tie.teamB,
        kickoffUtc: tie.leg1.kickoffUtc, label: `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`, status: "SCHEDULED" as const };
    }
    if (match.phaseId === "r16_leg2") {
      return { ...match, homeTeamId: tie.teamB, awayTeamId: tie.teamA,
        kickoffUtc: tie.leg2.kickoffUtc, label: `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`, status: "SCHEDULED" as const };
    }
    return match;
  });

  return { ...data, matches: updatedMatches };
}

export async function updateUclR16() {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log("UCL 2025-26: Updating R16 with Draw Results");

  log("1. Fetching R16 fixtures from API-Football...");
  const client = new ApiFootballClient();
  const allFixtures = await client.getFixtures({ league: 2, season: 2025 });
  const r16Fixtures = allFixtures.filter((f: any) => f.league.round === "Round of 16");
  log(`Found ${r16Fixtures.length} R16 fixtures`);

  if (r16Fixtures.length !== 16) {
    throw new ServiceError(`Expected 16 R16 fixtures, got ${r16Fixtures.length}`, 400, { logs });
  }

  const tieMap = new Map<string, any[]>();
  for (const f of r16Fixtures) {
    const homeApiId = f.teams.home.id;
    const awayApiId = f.teams.away.id;
    const key = [Math.min(homeApiId, awayApiId), Math.max(homeApiId, awayApiId)].join("-");
    if (!tieMap.has(key)) tieMap.set(key, []);
    tieMap.get(key)!.push(f);
  }

  if (tieMap.size !== 8) {
    throw new ServiceError(`Expected 8 R16 ties, got ${tieMap.size}`, 400, { logs });
  }

  const r16Ties: R16TieData[] = [];
  let tieNum = 1;
  for (const [, legs] of tieMap.entries()) {
    legs.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    const leg1 = legs[0]; const leg2 = legs[1];
    const teamA = API_TO_INTERNAL[leg1.teams.home.id];
    const teamB = API_TO_INTERNAL[leg1.teams.away.id];
    if (!teamA || !teamB) {
      throw new ServiceError(`Unknown API team ID: home=${leg1.teams.home.id} away=${leg1.teams.away.id}`, 400, { logs });
    }
    r16Ties.push({
      tieNumber: tieNum++, teamA, teamB,
      leg1: { fixtureId: leg1.fixture.id, kickoffUtc: new Date(leg1.fixture.date).toISOString() },
      leg2: { fixtureId: leg2.fixture.id, kickoffUtc: new Date(leg2.fixture.date).toISOString() },
    });
  }

  for (const tie of r16Ties) {
    log(`Tie ${tie.tieNumber}: ${tie.teamA} vs ${tie.teamB} | Leg1: #${tie.leg1.fixtureId} | Leg2: #${tie.leg2.fixtureId}`);
  }

  log("2. Loading tournament instance...");
  const instance = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
  if (!instance) {
    throw new ServiceError(`Instance ${UCL_INSTANCE_ID} not found`, 404, { logs });
  }

  const currentData = instance.dataJson as unknown as UclTemplateData;
  const r16Before = currentData.matches.filter((m) => m.phaseId.startsWith("r16_"));
  const placeholders = r16Before.filter((m) => m.status === "PLACEHOLDER");
  log(`Current R16 matches: ${r16Before.length}, Placeholders: ${placeholders.length}`);

  if (placeholders.length === 0) {
    // Instance already scheduled — update from API using match ID extraction
    log("Instance already SCHEDULED. Updating from API-Football using match ID extraction...");

    const SEED_R16_TEAMS: Record<number, { teamA: string; teamB: string }> = {
      1: { teamA: "t_GAL", teamB: "t_LIV" },
      2: { teamA: "t_NEW", teamB: "t_BAR" },
      3: { teamA: "t_ATM", teamB: "t_TOT" },
      4: { teamA: "t_ATA", teamB: "t_BAY" },
      5: { teamA: "t_LEV", teamB: "t_ARS" },
      6: { teamA: "t_PSG", teamB: "t_CHE" },
      7: { teamA: "t_BOD", teamB: "t_SPO" },
      8: { teamA: "t_RMA", teamB: "t_MCI" },
    };

    const findTieBySeedTeams = (tA: string, tB: string) =>
      r16Ties.find((t) =>
        (t.teamA === tA && t.teamB === tB) || (t.teamA === tB && t.teamB === tA));

    const extractTieNumber = (matchId: string): number | null => {
      const m = matchId.match(/^r16_(\d+)_leg[12]$/);
      return m?.[1] ? parseInt(m[1], 10) : null;
    };

    const teamName = (id: string) => currentData.teams.find((t: any) => t.id === id)?.name ?? id;
    const matchTieMap: { matchId: string; leg: "leg1" | "leg2"; tie: R16TieData }[] = [];

    const updatedMatches = currentData.matches.map((match) => {
      if (!match.phaseId.startsWith("r16_")) return match;
      const seedTieNum = extractTieNumber(match.id);
      if (!seedTieNum || !SEED_R16_TEAMS[seedTieNum]) {
        log(`WARNING: Cannot extract tieNumber from match ID ${match.id}`);
        return match;
      }
      const seedTeams = SEED_R16_TEAMS[seedTieNum];
      const tie = findTieBySeedTeams(seedTeams.teamA, seedTeams.teamB);
      if (!tie) {
        log(`WARNING: No API tie found for seed tie ${seedTieNum} (${seedTeams.teamA} vs ${seedTeams.teamB})`);
        return match;
      }
      if (match.phaseId === "r16_leg1") {
        matchTieMap.push({ matchId: match.id, leg: "leg1", tie });
        log(`${match.id}: ${teamName(tie.teamA)} vs ${teamName(tie.teamB)} | ${tie.leg1.kickoffUtc} | #${tie.leg1.fixtureId}`);
        return { ...match, kickoffUtc: tie.leg1.kickoffUtc, homeTeamId: tie.teamA, awayTeamId: tie.teamB,
          label: `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`, tieNumber: seedTieNum, status: "SCHEDULED" as const };
      }
      if (match.phaseId === "r16_leg2") {
        matchTieMap.push({ matchId: match.id, leg: "leg2", tie });
        log(`${match.id}: ${teamName(tie.teamB)} vs ${teamName(tie.teamA)} | ${tie.leg2.kickoffUtc} | #${tie.leg2.fixtureId}`);
        return { ...match, kickoffUtc: tie.leg2.kickoffUtc, homeTeamId: tie.teamB, awayTeamId: tie.teamA,
          label: `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`, tieNumber: seedTieNum, status: "SCHEDULED" as const };
      }
      return match;
    });

    const updatedData = { ...currentData, matches: updatedMatches };
    await prisma.tournamentInstance.update({ where: { id: UCL_INSTANCE_ID }, data: { dataJson: updatedData as unknown as Prisma.InputJsonValue } });
    log("Instance updated from API-Football");

    const version = await prisma.tournamentTemplateVersion.findUnique({ where: { id: UCL_VERSION_ID } });
    if (version) {
      const versionData = version.dataJson as unknown as UclTemplateData;
      const updatedVersionMatches = versionData.matches.map((match) => {
        if (!match.phaseId.startsWith("r16_")) return match;
        const seedTieNum = extractTieNumber(match.id);
        if (!seedTieNum || !SEED_R16_TEAMS[seedTieNum]) return match;
        const seedTeams = SEED_R16_TEAMS[seedTieNum];
        const tie = findTieBySeedTeams(seedTeams.teamA, seedTeams.teamB);
        if (!tie) return match;
        const vTeamName = (id: string) => versionData.teams.find((t: any) => t.id === id)?.name ?? id;
        if (match.phaseId === "r16_leg1") return { ...match, kickoffUtc: tie.leg1.kickoffUtc, homeTeamId: tie.teamA, awayTeamId: tie.teamB,
          label: `${vTeamName(tie.teamA)} vs ${vTeamName(tie.teamB)}`, tieNumber: seedTieNum, status: "SCHEDULED" as const };
        if (match.phaseId === "r16_leg2") return { ...match, kickoffUtc: tie.leg2.kickoffUtc, homeTeamId: tie.teamB, awayTeamId: tie.teamA,
          label: `${vTeamName(tie.teamB)} vs ${vTeamName(tie.teamA)}`, tieNumber: seedTieNum, status: "SCHEDULED" as const };
        return match;
      });
      await prisma.tournamentTemplateVersion.update({ where: { id: UCL_VERSION_ID }, data: { dataJson: { ...versionData, matches: updatedVersionMatches } as unknown as Prisma.InputJsonValue } });
      log("Template version updated");
    }

    log("Clearing stale R16 external mappings...");
    const deletedMappings = await prisma.matchExternalMapping.deleteMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
    });
    log(`Deleted ${deletedMappings.count} old R16 mappings`);

    log("Creating MatchSyncState and fixture mappings...");
    for (const { matchId, leg, tie } of matchTieMap) {
      const legData = leg === "leg1" ? tie.leg1 : tie.leg2;
      const kickoffUtc = new Date(legData.kickoffUtc);

      await prisma.matchSyncState.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: matchId } },
        create: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: matchId, syncStatus: "PENDING", kickoffUtc,
          firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000) },
        update: { kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000) },
      });

      await prisma.matchExternalMapping.create({
        data: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: matchId, apiFootballFixtureId: legData.fixtureId },
      });
    }
    log(`Created ${matchTieMap.length} sync states + mappings`);

    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID },
      select: { id: true, name: true },
    });
    for (const pool of pools) {
      await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: updatedData as unknown as Prisma.InputJsonValue } });
      log(`Synced pool: ${pool.name} (${pool.id})`);
    }

    return { message: `R16 updated from API-Football. Synced ${pools.length} pools.`, logs };
  }

  // Placeholder flow
  log("3. Updating instance dataJson...");
  const updatedData = updateMatchesWithR16Data(currentData, r16Ties);
  await prisma.tournamentInstance.update({ where: { id: UCL_INSTANCE_ID }, data: { dataJson: updatedData as unknown as Prisma.InputJsonValue } });

  log("4. Updating template version...");
  const version = await prisma.tournamentTemplateVersion.findUnique({ where: { id: UCL_VERSION_ID } });
  if (version) {
    const versionData = version.dataJson as unknown as UclTemplateData;
    const updatedVersionData = updateMatchesWithR16Data(versionData, r16Ties);
    await prisma.tournamentTemplateVersion.update({ where: { id: UCL_VERSION_ID }, data: { dataJson: updatedVersionData as unknown as Prisma.InputJsonValue } });
    log("Template version updated");
  }

  log("5. Creating R16 fixture mappings...");
  let mappingCount = 0;
  for (const tie of r16Ties) {
    for (const [legLabel, legData] of [["leg1", tie.leg1], ["leg2", tie.leg2]] as const) {
      await prisma.matchExternalMapping.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: `r16_${tie.tieNumber}_${legLabel}` } },
        create: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: `r16_${tie.tieNumber}_${legLabel}`, apiFootballFixtureId: legData.fixtureId },
        update: { apiFootballFixtureId: legData.fixtureId },
      });
      mappingCount++;
    }
  }
  log(`Created/updated ${mappingCount} fixture mappings`);

  log("6. Creating R16 sync states...");
  let syncCount = 0;
  for (const tie of r16Ties) {
    for (const leg of [
      { matchId: `r16_${tie.tieNumber}_leg1`, kickoff: tie.leg1.kickoffUtc },
      { matchId: `r16_${tie.tieNumber}_leg2`, kickoff: tie.leg2.kickoffUtc },
    ]) {
      const kickoffUtc = new Date(leg.kickoff);
      await prisma.matchSyncState.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: leg.matchId } },
        create: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: leg.matchId, syncStatus: "PENDING", kickoffUtc,
          firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000) },
        update: { kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60 * 1000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60 * 1000) },
      });
      syncCount++;
    }
  }
  log(`Created/updated ${syncCount} sync states`);

  log("7. Updating existing pools...");
  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: UCL_INSTANCE_ID },
    select: { id: true, name: true, fixtureSnapshot: true },
  });
  log(`Found ${pools.length} pool(s) to update`);

  for (const pool of pools) {
    const poolData = (pool.fixtureSnapshot ?? currentData) as unknown as UclTemplateData;
    const updatedPoolData = updateMatchesWithR16Data(poolData, r16Ties);
    await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: updatedPoolData as unknown as Prisma.InputJsonValue } });
    log(`Updated pool: ${pool.name} (${pool.id})`);
  }

  const verifyInstance = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
  const verifyData = verifyInstance!.dataJson as unknown as UclTemplateData;
  const r16After = verifyData.matches.filter((m) => m.phaseId.startsWith("r16_"));
  const scheduled = r16After.filter((m) => m.status === "SCHEDULED");
  const stillPlaceholder = r16After.filter((m) => m.status === "PLACEHOLDER");

  log(`Verification: SCHEDULED=${scheduled.length}/16, PLACEHOLDER=${stillPlaceholder.length}/16`);

  return {
    message: "UCL R16 update complete",
    stats: { mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length,
      scheduled: scheduled.length, stillPlaceholder: stillPlaceholder.length },
    logs,
  };
}

// ─── R16 Late Picks Audit ────────────────────────────────────

const R16_LEG1_KICKOFFS: Record<string, string> = {
  "r16_1_leg1": "2026-03-10T17:45:00Z",
  "r16_2_leg1": "2026-03-10T20:00:00Z",
  "r16_3_leg1": "2026-03-10T20:00:00Z",
  "r16_4_leg1": "2026-03-10T20:00:00Z",
  "r16_5_leg1": "2026-03-11T17:45:00Z",
  "r16_6_leg1": "2026-03-11T20:00:00Z",
  "r16_7_leg1": "2026-03-11T20:00:00Z",
  "r16_8_leg1": "2026-03-11T20:00:00Z",
};

const R16_LEG1_LABELS: Record<string, string> = {
  "r16_1_leg1": "Galatasaray vs Liverpool",
  "r16_2_leg1": "Newcastle vs Barcelona",
  "r16_3_leg1": "Atletico Madrid vs Tottenham",
  "r16_4_leg1": "Atalanta vs Bayern",
  "r16_5_leg1": "Bayer Leverkusen vs Arsenal",
  "r16_6_leg1": "PSG vs Chelsea",
  "r16_7_leg1": "Bodo/Glimt vs Sporting",
  "r16_8_leg1": "Real Madrid vs Man City",
};

export async function auditR16LatePicks() {
  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: UCL_INSTANCE_ID },
    select: { id: true, name: true, deadlineMinutesBeforeKickoff: true },
  });

  const r16Leg1MatchIds = Object.keys(R16_LEG1_KICKOFFS);

  const predictions = await prisma.prediction.findMany({
    where: {
      poolId: { in: pools.map((p) => p.id) },
      matchId: { in: r16Leg1MatchIds },
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      pool: { select: { id: true, name: true, deadlineMinutesBeforeKickoff: true } },
    },
    orderBy: { updatedAtUtc: "desc" },
  });

  const violations: any[] = [];

  for (const pred of predictions) {
    const kickoffStr = R16_LEG1_KICKOFFS[pred.matchId];
    if (!kickoffStr) continue;

    const kickoff = new Date(kickoffStr);
    const deadlineMinutes = pred.pool.deadlineMinutesBeforeKickoff ?? 10;
    const deadline = new Date(kickoff.getTime() - deadlineMinutes * 60 * 1000);
    const updatedAt = new Date(pred.updatedAtUtc);

    if (updatedAt > deadline) {
      violations.push({
        poolName: pred.pool.name,
        poolId: pred.pool.id,
        userName: pred.user.displayName ?? "Sin nombre",
        userEmail: pred.user.email,
        matchId: pred.matchId,
        matchLabel: R16_LEG1_LABELS[pred.matchId] ?? pred.matchId,
        kickoffUtc: kickoff.toISOString(),
        deadlineUtc: deadline.toISOString(),
        createdAtUtc: pred.createdAtUtc.toISOString(),
        updatedAtUtc: updatedAt.toISOString(),
        minutesAfterDeadline: Math.round((updatedAt.getTime() - deadline.getTime()) / 60000),
        minutesAfterKickoff: Math.round((updatedAt.getTime() - kickoff.getTime()) / 60000),
        pickJson: pred.pickJson,
      });
    }
  }

  violations.sort((a, b) => b.minutesAfterDeadline - a.minutesAfterDeadline);

  const poolSummary = pools.map((p) => {
    const poolViolations = violations.filter((v) => v.poolId === p.id);
    const totalPicks = predictions.filter((pred) => pred.poolId === p.id).length;
    return {
      poolName: p.name,
      poolId: p.id,
      deadlineMinutes: p.deadlineMinutesBeforeKickoff ?? 10,
      totalR16Leg1Picks: totalPicks,
      latePicksCount: poolViolations.length,
      lateUsers: [...new Set(poolViolations.map((v) => v.userName))],
    };
  });

  return {
    summary: {
      totalPools: pools.length,
      totalR16Leg1Predictions: predictions.length,
      totalViolations: violations.length,
      uniqueUsersWithViolations: [...new Set(violations.map((v) => v.userEmail))].length,
    },
    poolSummary,
    violations,
  };
}

// ─── R16 Integrity Fix ──────────────────────────────────────

export async function fixR16Integrity(dryRun: boolean) {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log(`=== UCL R16 Integrity Fix (dryRun=${dryRun}) ===`);

  const SEED_R16: Record<number, { teamA: string; teamB: string }> = {
    1: { teamA: "t_GAL", teamB: "t_LIV" },
    2: { teamA: "t_NEW", teamB: "t_BAR" },
    3: { teamA: "t_ATM", teamB: "t_TOT" },
    4: { teamA: "t_ATA", teamB: "t_BAY" },
    5: { teamA: "t_LEV", teamB: "t_ARS" },
    6: { teamA: "t_PSG", teamB: "t_CHE" },
    7: { teamA: "t_BOD", teamB: "t_SPO" },
    8: { teamA: "t_RMA", teamB: "t_MCI" },
  };

  const INTERNAL_TO_API: Record<string, number> = {};
  for (const [apiId, internalId] of Object.entries(API_TO_INTERNAL)) {
    INTERNAL_TO_API[internalId] = parseInt(apiId, 10);
  }

  log("STEP 1: Fetching R16 fixtures from API-Football...");
  const client = new ApiFootballClient();
  const allFixtures = await client.getFixtures({ league: 2, season: 2025 });
  const r16Fixtures = allFixtures.filter((f: any) => f.league.round === "Round of 16");
  log(`  Found ${r16Fixtures.length} R16 fixtures`);

  if (r16Fixtures.length !== 16) {
    throw new ServiceError(`Expected 16 R16 fixtures, got ${r16Fixtures.length}`, 400);
  }

  const fixtureById: Record<number, any> = {};
  for (const f of r16Fixtures) fixtureById[f.fixture.id] = f;

  log("STEP 2: Matching internal matches to API fixtures by team...");

  interface CorrectMapping {
    internalMatchId: string; tieNumber: number; leg: 1 | 2;
    expectedHomeInternal: string; expectedAwayInternal: string;
    fixtureId: number; fixtureHomeApiId: number; fixtureAwayApiId: number;
    fixtureHomeName: string; fixtureAwayName: string; fixtureDate: string;
    fixtureStatus: string; fixtureStatusShort: string;
    fixtureHomeGoals: number | null; fixtureAwayGoals: number | null;
  }

  const correctMappings: CorrectMapping[] = [];
  const errors: string[] = [];

  for (const [tieNumStr, teams] of Object.entries(SEED_R16)) {
    const tieNum = parseInt(tieNumStr, 10);
    const teamAApiId = INTERNAL_TO_API[teams.teamA];
    const teamBApiId = INTERNAL_TO_API[teams.teamB];

    if (!teamAApiId || !teamBApiId) {
      errors.push(`Missing API ID for ${teams.teamA} or ${teams.teamB}`);
      continue;
    }

    const tieFixtures = r16Fixtures.filter((f: any) => {
      const hId = f.teams.home.id;
      const aId = f.teams.away.id;
      return (hId === teamAApiId && aId === teamBApiId) || (hId === teamBApiId && aId === teamAApiId);
    });

    if (tieFixtures.length !== 2) {
      errors.push(`Tie ${tieNum} (${teams.teamA} vs ${teams.teamB}): Expected 2 fixtures, found ${tieFixtures.length}`);
      continue;
    }

    tieFixtures.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

    const leg1Fixture = tieFixtures[0]!;
    const leg2Fixture = tieFixtures[1]!;

    const leg1HomeInternal = API_TO_INTERNAL[leg1Fixture.teams.home.id];
    const leg1AwayInternal = API_TO_INTERNAL[leg1Fixture.teams.away.id];

    if (leg1HomeInternal !== teams.teamA || leg1AwayInternal !== teams.teamB) {
      log(`  Warning: Tie ${tieNum} Leg1: API has ${leg1HomeInternal}(H) vs ${leg1AwayInternal}(A), expected ${teams.teamA}(H) vs ${teams.teamB}(A). Using API order.`);
    }

    for (const [legNum, fixture, expHome, expAway] of [
      [1, leg1Fixture, teams.teamA, teams.teamB],
      [2, leg2Fixture, teams.teamB, teams.teamA],
    ] as [number, any, string, string][]) {
      const matchId = `r16_${tieNum}_leg${legNum}`;
      correctMappings.push({
        internalMatchId: matchId, tieNumber: tieNum, leg: legNum as 1 | 2,
        expectedHomeInternal: expHome, expectedAwayInternal: expAway,
        fixtureId: fixture.fixture.id,
        fixtureHomeApiId: fixture.teams.home.id, fixtureAwayApiId: fixture.teams.away.id,
        fixtureHomeName: fixture.teams.home.name, fixtureAwayName: fixture.teams.away.name,
        fixtureDate: fixture.fixture.date,
        fixtureStatus: fixture.fixture.status.long, fixtureStatusShort: fixture.fixture.status.short,
        fixtureHomeGoals: fixture.goals.home, fixtureAwayGoals: fixture.goals.away,
      });
      log(`  OK: ${matchId} -> #${fixture.fixture.id} ${fixture.teams.home.name} vs ${fixture.teams.away.name} | ${fixture.fixture.date.slice(0, 16)} | ${fixture.fixture.status.short} ${fixture.goals.home ?? "-"}-${fixture.goals.away ?? "-"}`);
    }
  }

  if (errors.length > 0) {
    throw new ServiceError("Validation errors", 400, { errors, logs });
  }

  // Step 3-6 omitted for brevity — the full fix logic is preserved in the route file
  // This service extracts the core data-building logic; the route handles dry-run branching

  log("STEP 3: Comparing with current DB state...");

  const currentMappings = await prisma.matchExternalMapping.findMany({
    where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
  });
  const currentMappingMap = new Map(currentMappings.map((m) => [m.internalMatchId, m]));

  const instanceRec = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
  if (!instanceRec) throw new ServiceError("Instance not found", 404);
  const instanceData = instanceRec.dataJson as unknown as UclTemplateData;
  const teamName = (id: string) => instanceData.teams.find((t: any) => t.id === id)?.name ?? id;

  const mappingFixes: { matchId: string; oldFixtureId: number | null; newFixtureId: number }[] = [];
  const kickoffFixes: { matchId: string; oldKickoff: string; newKickoff: string }[] = [];
  const teamFixes: { matchId: string; oldTeams: string; newTeams: string }[] = [];

  for (const cm of correctMappings) {
    const existing = currentMappingMap.get(cm.internalMatchId);
    if (!existing || existing.apiFootballFixtureId !== cm.fixtureId) {
      mappingFixes.push({ matchId: cm.internalMatchId, oldFixtureId: existing?.apiFootballFixtureId ?? null, newFixtureId: cm.fixtureId });
    }
    const instanceMatch = instanceData.matches.find((m) => m.id === cm.internalMatchId);
    if (instanceMatch) {
      const correctKickoff = new Date(cm.fixtureDate).toISOString();
      if (instanceMatch.kickoffUtc !== correctKickoff) {
        kickoffFixes.push({ matchId: cm.internalMatchId, oldKickoff: instanceMatch.kickoffUtc, newKickoff: correctKickoff });
      }
      if (instanceMatch.homeTeamId !== cm.expectedHomeInternal || instanceMatch.awayTeamId !== cm.expectedAwayInternal) {
        teamFixes.push({ matchId: cm.internalMatchId, oldTeams: `${instanceMatch.homeTeamId} vs ${instanceMatch.awayTeamId}`, newTeams: `${cm.expectedHomeInternal} vs ${cm.expectedAwayInternal}` });
      }
    }
  }

  log("STEP 4: Checking published results...");

  const pools = await prisma.pool.findMany({
    where: { tournamentInstanceId: UCL_INSTANCE_ID },
    select: { id: true, name: true },
  });

  const allR16MatchIds = correctMappings.map((cm) => cm.internalMatchId);
  const existingResults = await prisma.poolMatchResult.findMany({
    where: { poolId: { in: pools.map((p) => p.id) }, matchId: { in: allR16MatchIds } },
    include: { currentVersion: true, versions: true, pool: { select: { name: true } } },
  });

  const FINISHED_STATUSES = ["FT", "AET", "PEN"];
  const resultsToDelete: { id: string; matchId: string; poolName: string; reason: string; score: string }[] = [];
  const resultsCorrect: { matchId: string; poolName: string; score: string }[] = [];

  for (const result of existingResults) {
    const cv = result.currentVersion;
    if (!cv) continue;
    const cm = correctMappings.find((m) => m.internalMatchId === result.matchId);
    if (!cm) continue;
    const isFinished = FINISHED_STATUSES.includes(cm.fixtureStatusShort);
    const sourceFixtureId = cv.externalFixtureId;
    const wrongFixture = sourceFixtureId && sourceFixtureId !== cm.fixtureId;
    const matchNotFinished = !isFinished;

    if (wrongFixture) {
      resultsToDelete.push({ id: result.id, matchId: result.matchId, poolName: result.pool.name, reason: `Result from wrong fixture #${sourceFixtureId} (correct is #${cm.fixtureId})`, score: `${cv.homeGoals}-${cv.awayGoals}` });
    } else if (matchNotFinished && cv.source === "API_CONFIRMED") {
      resultsToDelete.push({ id: result.id, matchId: result.matchId, poolName: result.pool.name, reason: `Fixture #${cm.fixtureId} status is ${cm.fixtureStatusShort}, not finished`, score: `${cv.homeGoals}-${cv.awayGoals}` });
    } else if (isFinished) {
      resultsCorrect.push({ matchId: result.matchId, poolName: result.pool.name, score: `${cv.homeGoals}-${cv.awayGoals}` });
    }
  }

  log("STEP 5: Checking for missing results...");
  const finishedMappings = correctMappings.filter((cm) => FINISHED_STATUSES.includes(cm.fixtureStatusShort));
  const missingResults: { matchId: string; poolName: string; fixtureId: number; score: string }[] = [];

  for (const cm of finishedMappings) {
    for (const pool of pools) {
      const hasResult = existingResults.some(
        (r) => r.matchId === cm.internalMatchId && r.poolId === pool.id && !resultsToDelete.some((d) => d.id === r.id),
      );
      if (!hasResult) {
        missingResults.push({ matchId: cm.internalMatchId, poolName: pool.name, fixtureId: cm.fixtureId, score: `${cm.fixtureHomeGoals}-${cm.fixtureAwayGoals}` });
      }
    }
  }

  // STEP 6: Apply fixes (if not dry run)
  if (!dryRun) {
    log("STEP 6: APPLYING FIXES...");

    if (mappingFixes.length > 0) {
      await prisma.matchExternalMapping.deleteMany({
        where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
      });
      for (const cm of correctMappings) {
        await prisma.matchExternalMapping.create({
          data: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: cm.internalMatchId, apiFootballFixtureId: cm.fixtureId },
        });
      }
    }

    if (teamFixes.length > 0 || kickoffFixes.length > 0) {
      const updatedMatches = instanceData.matches.map((match) => {
        const cm = correctMappings.find((m) => m.internalMatchId === match.id);
        if (!cm) return match;
        return { ...match, homeTeamId: cm.expectedHomeInternal, awayTeamId: cm.expectedAwayInternal, kickoffUtc: new Date(cm.fixtureDate).toISOString(), label: `${teamName(cm.expectedHomeInternal)} vs ${teamName(cm.expectedAwayInternal)}`, status: "SCHEDULED" as const };
      });
      const updatedData = { ...instanceData, matches: updatedMatches };
      await prisma.tournamentInstance.update({ where: { id: UCL_INSTANCE_ID }, data: { dataJson: updatedData as unknown as Prisma.InputJsonValue } });
    }

    for (const cm of correctMappings) {
      const kickoffUtc = new Date(cm.fixtureDate);
      const isFinished = FINISHED_STATUSES.includes(cm.fixtureStatusShort);
      await prisma.matchSyncState.upsert({
        where: { tournamentInstanceId_internalMatchId: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: cm.internalMatchId } },
        create: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: cm.internalMatchId, syncStatus: isFinished ? "COMPLETED" : "PENDING", kickoffUtc, firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60_000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60_000), completedAtUtc: isFinished ? new Date() : null, lastApiStatus: cm.fixtureStatusShort },
        update: { kickoffUtc, syncStatus: isFinished ? "COMPLETED" : "PENDING", firstCheckAtUtc: new Date(kickoffUtc.getTime() + 5 * 60_000), finishCheckAtUtc: new Date(kickoffUtc.getTime() + 110 * 60_000), completedAtUtc: isFinished ? new Date() : null, lastApiStatus: cm.fixtureStatusShort, lastCheckedAtUtc: isFinished ? new Date() : null },
      });
    }

    for (const rd of resultsToDelete) {
      await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: rd.id } });
      await prisma.poolMatchResult.delete({ where: { id: rd.id } });
    }

    if (missingResults.length > 0) {
      const { parseFixtureResult } = await import("../services/apiFootball");
      for (const mr of missingResults) {
        const fixture = fixtureById[mr.fixtureId];
        const parsedResult = parseFixtureResult(fixture);
        if (!parsedResult || !parsedResult.isFinished) continue;
        const pool = pools.find((p) => p.name === mr.poolName);
        if (!pool) continue;
        const wentToExtraTime = parsedResult.status === "AET" || parsedResult.status === "PEN";
        await prisma.$transaction(async (tx) => {
          const header = await tx.poolMatchResult.create({ data: { poolId: pool.id, matchId: mr.matchId } });
          const ver = await tx.poolMatchResultVersion.create({
            data: {
              resultId: header.id, versionNumber: 1, status: "PUBLISHED",
              homeGoals: parsedResult.homeGoals, awayGoals: parsedResult.awayGoals,
              homeGoals90: wentToExtraTime ? parsedResult.fulltimeHome : null,
              awayGoals90: wentToExtraTime ? parsedResult.fulltimeAway : null,
              homePenalties: parsedResult.penaltyHome, awayPenalties: parsedResult.penaltyAway,
              source: "API_CONFIRMED", externalFixtureId: fixture.fixture.id, externalDataJson: fixture,
              createdByUserId: null,
            },
          });
          await tx.poolMatchResult.update({ where: { id: header.id }, data: { currentVersionId: ver.id } });
        });
      }
    }

    log("STEP 6: ALL FIXES APPLIED");
  } else {
    log("STEP 6: DRY RUN — no changes applied. Call with dryRun=false to apply.");
  }

  return {
    dryRun,
    summary: {
      mappingFixes: mappingFixes.length,
      kickoffFixes: kickoffFixes.length,
      teamFixes: teamFixes.length,
      resultsToDelete: resultsToDelete.length,
      missingResults: missingResults.length,
      correctResults: resultsCorrect.length,
    },
    correctMappings: correctMappings.map((cm) => ({
      matchId: cm.internalMatchId, fixtureId: cm.fixtureId,
      teams: `${cm.fixtureHomeName} vs ${cm.fixtureAwayName}`,
      date: cm.fixtureDate, status: cm.fixtureStatusShort,
      score: `${cm.fixtureHomeGoals ?? "-"}-${cm.fixtureAwayGoals ?? "-"}`,
    })),
    fixes: {
      mappings: mappingFixes, kickoffs: kickoffFixes, teams: teamFixes,
      resultsToDelete, missingResults, correctResults: resultsCorrect,
    },
    logs,
  };
}

// ─── WC2026 Data Builder ─────────────────────────────────────

type Team = { id: string; name: string; code?: string; groupId?: string };

const WC2026_TEAMS_BY_GROUP: Record<string, [string, string, string, string]> = {
  A: ["Mexico", "Corea del Sur", "Sudafrica", "TBD (Playoff Europa D)"],
  B: ["Canada", "Qatar", "Suiza", "TBD (Playoff Europa A)"],
  C: ["Brasil", "Haiti", "Marruecos", "Escocia"],
  D: ["Estados Unidos", "Australia", "Paraguay", "TBD (Playoff Europa C)"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Paises Bajos", "Japon", "Tunez", "TBD (Playoff Europa B)"],
  G: ["Iran", "Nueva Zelanda", "Belgica", "Chile"],
  H: ["Espana", "Cabo Verde", "Arabia Saudita", "Uruguay"],
  I: ["Francia", "Senegal", "Noruega", "TBD (Playoff Intercontinental 2)"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Uzbekistan", "Colombia", "TBD (Playoff Intercontinental 1)"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panama"],
};

function buildWc2026SandboxData() {
  const groups = "ABCDEFGHIJKL".split("");
  const teamsPerGroup = 4;

  const teams: Team[] = [];
  for (const g of groups) {
    const groupTeams = WC2026_TEAMS_BY_GROUP[g];
    if (!groupTeams) continue;
    for (let i = 1; i <= teamsPerGroup; i++) {
      teams.push({ id: `t_${g}${i}`, name: groupTeams[i - 1]!, code: `${g}${i}`, groupId: g });
    }
  }

  const phases = [
    { id: "group_stage", name: "Fase de Grupos", type: "GROUP", order: 1, config: { groupsCount: 12, teamsPerGroup: 4 } },
    { id: "round_of_32", name: "Dieciseisavos de Final", type: "KNOCKOUT", order: 2, config: { matchesCount: 16 } },
    { id: "round_of_16", name: "Octavos de Final", type: "KNOCKOUT", order: 3, config: { matchesCount: 8 } },
    { id: "quarter_finals", name: "Cuartos de Final", type: "KNOCKOUT", order: 4, config: { matchesCount: 4 } },
    { id: "semi_finals", name: "Semifinales", type: "KNOCKOUT", order: 5, config: { matchesCount: 2 } },
    { id: "finals", name: "Final", type: "KNOCKOUT", order: 6, config: { matchesCount: 2 } },
  ];

  const pairings = [
    { round: 1, a: 1, b: 2 }, { round: 1, a: 3, b: 4 },
    { round: 2, a: 1, b: 3 }, { round: 2, a: 2, b: 4 },
    { round: 3, a: 1, b: 4 }, { round: 3, a: 2, b: 3 },
  ];

  let kickoff = new Date("2026-06-11T18:00:00Z").getTime();
  const twoHours = 2 * 60 * 60 * 1000;
  let matchNumber = 1;
  const matches: any[] = [];

  for (const g of groups) {
    const t = (n: number) => `t_${g}${n}`;
    for (let k = 0; k < pairings.length; k++) {
      const p = pairings[k]!;
      matches.push({
        id: `m_${g}_${p.round}_${k + 1}`, phaseId: "group_stage",
        kickoffUtc: new Date(kickoff).toISOString(), matchNumber,
        roundLabel: `Grupo ${g} - J${p.round}`, venue: `Estadio ${(matchNumber % 16) + 1}`,
        groupId: g, homeTeamId: t(p.a), awayTeamId: t(p.b),
      });
      kickoff += twoHours;
      matchNumber++;
    }
  }

  kickoff += 3 * 24 * 60 * 60 * 1000;

  // R32 — Official FIFA WC 2026 bracket (matches 73-88)
  const r32Matchups: [string, string][] = [
    ["RU_A", "RU_B"], ["W_E", "3rd_POOL_1"], ["W_F", "RU_C"], ["W_C", "RU_F"],
    ["W_I", "3rd_POOL_2"], ["RU_E", "RU_I"], ["W_A", "3rd_POOL_3"], ["W_L", "3rd_POOL_4"],
    ["W_D", "3rd_POOL_5"], ["W_G", "3rd_POOL_6"], ["RU_K", "RU_L"], ["W_H", "RU_J"],
    ["W_B", "3rd_POOL_7"], ["W_J", "RU_H"], ["W_K", "3rd_POOL_8"], ["RU_D", "RU_G"],
  ];
  for (let i = 0; i < r32Matchups.length; i++) {
    matches.push({
      id: `m_R32_${i + 1}`, phaseId: "round_of_32",
      kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
      roundLabel: `R32 - Partido ${i + 1}`, venue: `Estadio ${((i + 1) % 16) + 1}`,
      homeTeamId: r32Matchups[i]![0], awayTeamId: r32Matchups[i]![1],
    });
    kickoff += twoHours;
  }

  // R16 — FIFA bracket connections (matches 89-96)
  kickoff += 2 * 24 * 60 * 60 * 1000;
  const r16Matchups: [string, string][] = [
    ["W_R32_2", "W_R32_5"], ["W_R32_1", "W_R32_3"], ["W_R32_4", "W_R32_6"], ["W_R32_7", "W_R32_8"],
    ["W_R32_11", "W_R32_12"], ["W_R32_9", "W_R32_10"], ["W_R32_14", "W_R32_16"], ["W_R32_13", "W_R32_15"],
  ];
  for (let i = 0; i < r16Matchups.length; i++) {
    matches.push({
      id: `m_R16_${i + 1}`, phaseId: "round_of_16",
      kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
      roundLabel: `Octavos - Partido ${i + 1}`, venue: `Estadio ${((i + 1) % 16) + 1}`,
      homeTeamId: r16Matchups[i]![0], awayTeamId: r16Matchups[i]![1],
    });
    kickoff += twoHours;
  }

  // QF — FIFA bracket connections (matches 97-100)
  kickoff += 2 * 24 * 60 * 60 * 1000;
  const qfMatchups: [string, string][] = [
    ["W_R16_1", "W_R16_2"], ["W_R16_5", "W_R16_6"], ["W_R16_3", "W_R16_4"], ["W_R16_7", "W_R16_8"],
  ];
  for (let i = 0; i < qfMatchups.length; i++) {
    matches.push({
      id: `m_QF_${i + 1}`, phaseId: "quarter_finals",
      kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
      roundLabel: `Cuartos - Partido ${i + 1}`, venue: `Estadio ${((i + 1) % 16) + 1}`,
      homeTeamId: qfMatchups[i]![0], awayTeamId: qfMatchups[i]![1],
    });
    kickoff += twoHours;
  }

  // SF — FIFA bracket connections (matches 101-102)
  kickoff += 2 * 24 * 60 * 60 * 1000;
  const sfMatchups: [string, string][] = [
    ["W_QF_1", "W_QF_2"], ["W_QF_3", "W_QF_4"],
  ];
  for (let i = 0; i < sfMatchups.length; i++) {
    matches.push({
      id: `m_SF_${i + 1}`, phaseId: "semi_finals",
      kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
      roundLabel: `Semifinal ${i + 1}`, venue: `Estadio Final`,
      homeTeamId: sfMatchups[i]![0], awayTeamId: sfMatchups[i]![1],
    });
    kickoff += twoHours;
  }

  kickoff += 2 * 24 * 60 * 60 * 1000;
  matches.push({
    id: "m_3RD", phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
    roundLabel: "Tercer Lugar", venue: "Estadio Final",
    homeTeamId: "L_SF_1", awayTeamId: "L_SF_2",
  });
  kickoff += twoHours;
  matches.push({
    id: "m_FINAL", phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(), matchNumber: matchNumber++,
    roundLabel: "Final", venue: "Estadio Final",
    homeTeamId: "W_SF_1", awayTeamId: "W_SF_2",
  });

  return {
    meta: { name: "World Cup 2026 (Sandbox)", competition: "FIFA World Cup", seasonYear: 2026, sport: "football" },
    teams, phases, matches,
  };
}
