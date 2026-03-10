import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { prisma } from "../db";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";
import { ApiFootballClient } from "../services/apiFootball/client";

export const adminRouter = Router();

// Comentario en español: endpoint de prueba para validar RBAC admin
adminRouter.get("/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, admin: true });
});

// GET /admin/stats — platform stats (users, pools, feedback)
adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
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

  res.json({
    users: {
      total: totalUsers,
      test: testUsers,
      real: totalUsers - testUsers,
      byMonth: usersByMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
    },
    pools: { total: totalPools },
    feedback: { total: totalFeedback },
  });
});

// Bootstrap-admin disabled in production — use seed script for admin creation
adminRouter.post("/bootstrap-admin", (_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// Endpoint para seedear WC2026 en producción (solo admin)
adminRouter.post("/seed-wc2026", requireAuth, requireAdmin, async (_req, res) => {
  try {
    // Check if already seeded
    const existing = await prisma.tournamentInstance.findFirst({
      where: { name: "WC 2026 (Sandbox Instance)" },
    });

    if (existing) {
      return res.json({ ok: true, message: "WC2026 ya existe", instanceId: existing.id });
    }

    // Build WC2026 data
    const raw = buildWc2026SandboxData();
    const parsed = templateDataSchema.parse(raw);
    const issues = validateTemplateDataConsistency(parsed);
    if (issues.length) {
      return res.status(400).json({ ok: false, error: `TemplateData inconsistente: ${issues.join(", ")}` });
    }

    const key = "wc_2026_sandbox";
    const templateName = "World Cup 2026 (Sandbox)";
    const instanceName = "WC 2026 (Sandbox Instance)";
    const now = new Date();

    // Upsert template
    const template = await prisma.tournamentTemplate.upsert({
      where: { key },
      update: { name: templateName, status: "PUBLISHED" },
      create: { key, name: templateName, status: "PUBLISHED" },
    });

    // Create version
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
        dataJson: parsed as any,
      },
    });

    await prisma.tournamentTemplate.update({
      where: { id: template.id },
      data: { currentPublishedVersionId: version.id, status: "PUBLISHED" },
    });

    // Create instance
    const instance = await prisma.tournamentInstance.create({
      data: {
        name: instanceName,
        status: "ACTIVE",
        templateId: template.id,
        templateVersionId: version.id,
        dataJson: parsed as any,
      },
    });

    res.json({
      ok: true,
      message: "WC2026 Sandbox creado exitosamente",
      templateId: template.id,
      versionId: version.id,
      instanceId: instance.id,
    });
  } catch (error: any) {
    console.error("Error seeding WC2026:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ========== UCL R16 Update (from updateUclR16Draw script) ==========

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

adminRouter.post("/update-ucl-r16", requireAuth, requireAdmin, async (_req, res) => {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };
  try {

    log("UCL 2025-26: Updating R16 with Draw Results");

    // 1. Fetch R16 data from API-Football
    log("1. Fetching R16 fixtures from API-Football...");
    const client = new ApiFootballClient();
    const allFixtures = await client.getFixtures({ league: 2, season: 2025 });
    const r16Fixtures = allFixtures.filter((f: any) => f.league.round === "Round of 16");
    log(`Found ${r16Fixtures.length} R16 fixtures`);

    if (r16Fixtures.length !== 16) {
      return res.status(400).json({ ok: false, error: `Expected 16 R16 fixtures, got ${r16Fixtures.length}`, logs });
    }

    // Group into ties
    const tieMap = new Map<string, any[]>();
    for (const f of r16Fixtures) {
      const homeApiId = f.teams.home.id;
      const awayApiId = f.teams.away.id;
      const key = [Math.min(homeApiId, awayApiId), Math.max(homeApiId, awayApiId)].join("-");
      if (!tieMap.has(key)) tieMap.set(key, []);
      tieMap.get(key)!.push(f);
    }

    if (tieMap.size !== 8) {
      return res.status(400).json({ ok: false, error: `Expected 8 R16 ties, got ${tieMap.size}`, logs });
    }

    const r16Ties: R16TieData[] = [];
    let tieNum = 1;
    for (const [, legs] of tieMap.entries()) {
      legs.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
      const leg1 = legs[0]; const leg2 = legs[1];
      const teamA = API_TO_INTERNAL[leg1.teams.home.id];
      const teamB = API_TO_INTERNAL[leg1.teams.away.id];
      if (!teamA || !teamB) {
        return res.status(400).json({ ok: false, error: `Unknown API team ID: home=${leg1.teams.home.id} away=${leg1.teams.away.id}`, logs });
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

    // 2. Load and update instance
    log("2. Loading tournament instance...");
    const instance = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
    if (!instance) {
      return res.status(404).json({ ok: false, error: `Instance ${UCL_INSTANCE_ID} not found`, logs });
    }

    const currentData = instance.dataJson as unknown as UclTemplateData;
    const r16Before = currentData.matches.filter((m) => m.phaseId.startsWith("r16_"));
    const placeholders = r16Before.filter((m) => m.status === "PLACEHOLDER");
    log(`Current R16 matches: ${r16Before.length}, Placeholders: ${placeholders.length}`);

    if (placeholders.length === 0) {
      // Instance already SCHEDULED. Previous runs may have corrupted team assignments,
      // so we match by SEED match ID (r16_{N}_leg{1|2}) → original team pair → API tie.
      log("Instance already SCHEDULED. Updating from API-Football using match ID extraction...");

      // Original seed team assignments (source of truth for match IDs)
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

      // Helper: find API tie by original seed teams (order-independent)
      const findTieBySeedTeams = (teamA: string, teamB: string) =>
        r16Ties.find((t) =>
          (t.teamA === teamA && t.teamB === teamB) ||
          (t.teamA === teamB && t.teamB === teamA));

      // Extract tieNumber from match ID: "r16_3_leg1" → 3
      const extractTieNumber = (matchId: string): number | null => {
        const m = matchId.match(/^r16_(\d+)_leg[12]$/);
        return m?.[1] ? parseInt(m[1], 10) : null;
      };

      const teamName = (id: string) => currentData.teams.find((t: any) => t.id === id)?.name ?? id;

      // Track match ID → API tie for mappings/sync later
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
      await prisma.tournamentInstance.update({ where: { id: UCL_INSTANCE_ID }, data: { dataJson: updatedData as any } });
      log("Instance updated from API-Football");

      // Also update template version
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
        await prisma.tournamentTemplateVersion.update({ where: { id: UCL_VERSION_ID }, data: { dataJson: { ...versionData, matches: updatedVersionMatches } as any } });
        log("Template version updated");
      }

      // Clear stale R16 mappings first (previous runs may have created wrong assignments)
      log("Clearing stale R16 external mappings...");
      const deletedMappings = await prisma.matchExternalMapping.deleteMany({
        where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
      });
      log(`Deleted ${deletedMappings.count} old R16 mappings`);

      // Recreate MatchSyncState + MatchExternalMapping using correct data
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

      // Sync all pools
      const pools = await prisma.pool.findMany({
        where: { tournamentInstanceId: UCL_INSTANCE_ID },
        select: { id: true, name: true },
      });
      for (const pool of pools) {
        await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: updatedData as any } });
        log(`Synced pool: ${pool.name} (${pool.id})`);
      }

      return res.json({ ok: true, message: `R16 updated from API-Football. Synced ${pools.length} pools.`, logs });
    }

    // 3. Update instance
    log("3. Updating instance dataJson...");
    const updatedData = updateMatchesWithR16Data(currentData, r16Ties);
    await prisma.tournamentInstance.update({ where: { id: UCL_INSTANCE_ID }, data: { dataJson: updatedData as any } });

    // 4. Update template version
    log("4. Updating template version...");
    const version = await prisma.tournamentTemplateVersion.findUnique({ where: { id: UCL_VERSION_ID } });
    if (version) {
      const versionData = version.dataJson as unknown as UclTemplateData;
      const updatedVersionData = updateMatchesWithR16Data(versionData, r16Ties);
      await prisma.tournamentTemplateVersion.update({ where: { id: UCL_VERSION_ID }, data: { dataJson: updatedVersionData as any } });
      log("Template version updated");
    }

    // 5. Create MatchExternalMapping
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

    // 6. Create MatchSyncState
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

    // 7. Update ALL existing pools
    log("7. Updating existing pools...");
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID },
      select: { id: true, name: true, fixtureSnapshot: true },
    });
    log(`Found ${pools.length} pool(s) to update`);

    for (const pool of pools) {
      const poolData = (pool.fixtureSnapshot ?? currentData) as unknown as UclTemplateData;
      const updatedPoolData = updateMatchesWithR16Data(poolData, r16Ties);
      await prisma.pool.update({ where: { id: pool.id }, data: { fixtureSnapshot: updatedPoolData as any } });
      log(`Updated pool: ${pool.name} (${pool.id})`);
    }

    // Verify
    const verifyInstance = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
    const verifyData = verifyInstance!.dataJson as unknown as UclTemplateData;
    const r16After = verifyData.matches.filter((m) => m.phaseId.startsWith("r16_"));
    const scheduled = r16After.filter((m) => m.status === "SCHEDULED");
    const stillPlaceholder = r16After.filter((m) => m.status === "PLACEHOLDER");

    log(`Verification: SCHEDULED=${scheduled.length}/16, PLACEHOLDER=${stillPlaceholder.length}/16`);

    res.json({
      ok: true,
      message: "UCL R16 update complete",
      stats: { mappings: mappingCount, syncStates: syncCount, poolsUpdated: pools.length,
        scheduled: scheduled.length, stillPlaceholder: stillPlaceholder.length },
      logs,
    });
  } catch (error: any) {
    console.error("Error updating UCL R16:", error);
    log(`ERROR: ${error.message}`);
    res.status(500).json({ ok: false, error: error.message, logs });
  }
});

// ========== UCL R16 Audit: late picks ==========

// Real kickoff times from API-Football for R16 Leg 1
const R16_LEG1_KICKOFFS: Record<string, string> = {
  "r16_1_leg1": "2026-03-10T17:45:00Z", // GAL vs LIV
  "r16_2_leg1": "2026-03-10T20:00:00Z", // NEW vs BAR
  "r16_3_leg1": "2026-03-10T20:00:00Z", // ATM vs TOT
  "r16_4_leg1": "2026-03-10T20:00:00Z", // ATA vs BAY
  "r16_5_leg1": "2026-03-11T17:45:00Z", // LEV vs ARS
  "r16_6_leg1": "2026-03-11T20:00:00Z", // PSG vs CHE
  "r16_7_leg1": "2026-03-11T20:00:00Z", // BOD vs SPO
  "r16_8_leg1": "2026-03-11T20:00:00Z", // RMA vs MCI
};

const R16_LEG1_LABELS: Record<string, string> = {
  "r16_1_leg1": "Galatasaray vs Liverpool",
  "r16_2_leg1": "Newcastle vs Barcelona",
  "r16_3_leg1": "Atlético Madrid vs Tottenham",
  "r16_4_leg1": "Atalanta vs Bayern",
  "r16_5_leg1": "Bayer Leverkusen vs Arsenal",
  "r16_6_leg1": "PSG vs Chelsea",
  "r16_7_leg1": "Bodø/Glimt vs Sporting",
  "r16_8_leg1": "Real Madrid vs Man City",
};

adminRouter.get("/audit/r16-late-picks", requireAuth, requireAdmin, async (_req, res) => {
  try {
    // Get all UCL pools
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID },
      select: { id: true, name: true, deadlineMinutesBeforeKickoff: true },
    });

    const r16Leg1MatchIds = Object.keys(R16_LEG1_KICKOFFS);

    // Get all R16 leg1 predictions across all UCL pools
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

    const violations: {
      poolName: string;
      poolId: string;
      userName: string;
      userEmail: string;
      matchId: string;
      matchLabel: string;
      kickoffUtc: string;
      deadlineUtc: string;
      createdAtUtc: string;
      updatedAtUtc: string;
      minutesAfterDeadline: number;
      minutesAfterKickoff: number;
      pickJson: any;
    }[] = [];

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

    // Sort by most egregious first
    violations.sort((a, b) => b.minutesAfterDeadline - a.minutesAfterDeadline);

    // Summary per pool
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

    res.json({
      ok: true,
      summary: {
        totalPools: pools.length,
        totalR16Leg1Predictions: predictions.length,
        totalViolations: violations.length,
        uniqueUsersWithViolations: [...new Set(violations.map((v) => v.userEmail))].length,
      },
      poolSummary,
      violations,
    });
  } catch (error: any) {
    console.error("Error in R16 audit:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ========== UCL R16 Audit: mappings & wrong results ==========

adminRouter.get("/audit/r16-mappings", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    log("=== UCL R16 Mapping & Results Audit ===");

    // 1. Fetch current R16 fixtures from API-Football to get ground truth
    log("1. Fetching R16 fixtures from API-Football...");
    const client = new ApiFootballClient();
    const allFixtures = await client.getFixtures({ league: 2, season: 2025 });
    const r16Fixtures = allFixtures.filter((f: any) => f.league.round === "Round of 16");
    log(`Found ${r16Fixtures.length} R16 fixtures from API`);

    // Build ground truth: fixtureId → { homeTeam, awayTeam, status, score, date }
    const fixtureInfo: Record<number, {
      homeTeamApiId: number; awayTeamApiId: number;
      homeTeamName: string; awayTeamName: string;
      homeInternal: string; awayInternal: string;
      status: string; statusShort: string;
      homeGoals: number | null; awayGoals: number | null;
      date: string;
    }> = {};
    for (const f of r16Fixtures) {
      fixtureInfo[f.fixture.id] = {
        homeTeamApiId: f.teams.home.id,
        awayTeamApiId: f.teams.away.id,
        homeTeamName: f.teams.home.name,
        awayTeamName: f.teams.away.name,
        homeInternal: API_TO_INTERNAL[f.teams.home.id] ?? `UNKNOWN(${f.teams.home.id})`,
        awayInternal: API_TO_INTERNAL[f.teams.away.id] ?? `UNKNOWN(${f.teams.away.id})`,
        status: f.fixture.status.long,
        statusShort: f.fixture.status.short,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        date: f.fixture.date,
      };
    }

    // 2. Get current mappings from DB
    log("2. Loading current MatchExternalMapping...");
    const mappings = await prisma.matchExternalMapping.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
      orderBy: { internalMatchId: "asc" },
    });
    log(`Found ${mappings.length} R16 mappings`);

    // 3. Get instance data for expected teams
    const instance = await prisma.tournamentInstance.findUnique({ where: { id: UCL_INSTANCE_ID } });
    const instanceData = instance?.dataJson as unknown as UclTemplateData | undefined;
    const instanceMatches = instanceData?.matches ?? [];

    // 4. Verify each mapping
    log("3. Verifying mappings...");
    const mappingAudit: any[] = [];
    for (const mapping of mappings) {
      const fixture = fixtureInfo[mapping.apiFootballFixtureId];
      const instanceMatch = instanceMatches.find((m) => m.id === mapping.internalMatchId);

      const seedTieNumMatch = mapping.internalMatchId.match(/^r16_(\d+)_leg([12])$/);
      const seedTieNum = seedTieNumMatch?.[1] ? parseInt(seedTieNumMatch[1], 10) : null;
      const legNum = seedTieNumMatch?.[2] ?? "?";

      // Expected teams from seed
      const SEED_R16: Record<number, { teamA: string; teamB: string }> = {
        1: { teamA: "t_GAL", teamB: "t_LIV" }, 2: { teamA: "t_NEW", teamB: "t_BAR" },
        3: { teamA: "t_ATM", teamB: "t_TOT" }, 4: { teamA: "t_ATA", teamB: "t_BAY" },
        5: { teamA: "t_LEV", teamB: "t_ARS" }, 6: { teamA: "t_PSG", teamB: "t_CHE" },
        7: { teamA: "t_BOD", teamB: "t_SPO" }, 8: { teamA: "t_RMA", teamB: "t_MCI" },
      };
      const seedTeams = seedTieNum ? SEED_R16[seedTieNum] : null;

      // For leg1: home=teamA, away=teamB. For leg2: home=teamB, away=teamA
      const expectedHome = seedTeams ? (legNum === "1" ? seedTeams.teamA : seedTeams.teamB) : "?";
      const expectedAway = seedTeams ? (legNum === "1" ? seedTeams.teamB : seedTeams.teamA) : "?";

      let teamMatch = "UNKNOWN";
      if (fixture) {
        const correctDirect = fixture.homeInternal === expectedHome && fixture.awayInternal === expectedAway;
        const correctSwapped = fixture.homeInternal === expectedAway && fixture.awayInternal === expectedHome;
        teamMatch = correctDirect ? "CORRECT" : correctSwapped ? "SWAPPED" : "WRONG";
      }

      const entry: any = {
        internalMatchId: mapping.internalMatchId,
        fixtureId: mapping.apiFootballFixtureId,
        expectedTeams: `${expectedHome} vs ${expectedAway}`,
        apiTeams: fixture ? `${fixture.homeInternal} (${fixture.homeTeamName}) vs ${fixture.awayInternal} (${fixture.awayTeamName})` : "FIXTURE NOT FOUND",
        teamMatch,
        fixtureStatus: fixture?.status ?? "N/A",
        fixtureStatusShort: fixture?.statusShort ?? "N/A",
        fixtureDate: fixture?.date ?? "N/A",
        fixtureScore: fixture ? `${fixture.homeGoals}-${fixture.awayGoals}` : "N/A",
        instanceTeams: instanceMatch ? `${instanceMatch.homeTeamId} vs ${instanceMatch.awayTeamId}` : "NOT IN INSTANCE",
      };

      if (teamMatch === "WRONG") {
        log(`❌ ${mapping.internalMatchId} → fixture #${mapping.apiFootballFixtureId}: Expected ${expectedHome} vs ${expectedAway}, got ${fixture!.homeInternal} vs ${fixture!.awayInternal}`);
      } else if (teamMatch === "CORRECT") {
        log(`✅ ${mapping.internalMatchId} → fixture #${mapping.apiFootballFixtureId}: ${fixture!.homeTeamName} vs ${fixture!.awayTeamName} (${fixture!.statusShort})`);
      }

      mappingAudit.push(entry);
    }

    // 5. Check for wrong results in pools
    log("4. Checking for published results on R16 matches...");
    const pools = await prisma.pool.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID },
      select: { id: true, name: true },
    });

    const r16MatchIds = mappings.map((m) => m.internalMatchId);
    const existingResults = await prisma.poolMatchResult.findMany({
      where: {
        poolId: { in: pools.map((p) => p.id) },
        matchId: { in: r16MatchIds },
      },
      include: {
        currentVersion: true,
        pool: { select: { name: true } },
      },
    });

    const resultsAudit: any[] = [];
    for (const result of existingResults) {
      const mapping = mappings.find((m) => m.internalMatchId === result.matchId);
      const fixture = mapping ? fixtureInfo[mapping.apiFootballFixtureId] : null;
      const cv = result.currentVersion;

      resultsAudit.push({
        poolName: result.pool.name,
        matchId: result.matchId,
        resultScore: cv ? `${cv.homeGoals}-${cv.awayGoals}` : "NO VERSION",
        source: cv?.source ?? "N/A",
        fixtureId: mapping?.apiFootballFixtureId ?? "NO MAPPING",
        fixtureStatus: fixture?.statusShort ?? "N/A",
        fixtureRealTeams: fixture ? `${fixture.homeTeamName} vs ${fixture.awayTeamName}` : "N/A",
        publishedAt: cv?.createdAtUtc ?? "N/A",
        versionNumber: cv?.versionNumber ?? 0,
      });

      log(`⚠️ Result exists: [${result.pool.name}] ${result.matchId} = ${cv ? `${cv.homeGoals}-${cv.awayGoals}` : "?"} (source: ${cv?.source}, fixture status: ${fixture?.statusShort ?? "?"})`);
    }

    // 6. Check MatchSyncState for R16
    log("5. Checking MatchSyncState...");
    const syncStates = await prisma.matchSyncState.findMany({
      where: { tournamentInstanceId: UCL_INSTANCE_ID, internalMatchId: { startsWith: "r16_" } },
      orderBy: { internalMatchId: "asc" },
    });

    const syncAudit = syncStates.map((s) => ({
      matchId: s.internalMatchId,
      syncStatus: s.syncStatus,
      kickoffUtc: s.kickoffUtc.toISOString(),
      lastCheckedAt: s.lastCheckedAtUtc?.toISOString() ?? null,
    }));

    res.json({
      ok: true,
      summary: {
        totalMappings: mappings.length,
        correctMappings: mappingAudit.filter((m) => m.teamMatch === "CORRECT").length,
        wrongMappings: mappingAudit.filter((m) => m.teamMatch === "WRONG").length,
        swappedMappings: mappingAudit.filter((m) => m.teamMatch === "SWAPPED").length,
        unknownMappings: mappingAudit.filter((m) => m.teamMatch === "UNKNOWN").length,
        publishedResults: existingResults.length,
      },
      mappings: mappingAudit,
      results: resultsAudit,
      syncStates: syncAudit,
      logs,
    });
  } catch (error: any) {
    console.error("Error in R16 mapping audit:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ========== WC2026 Data Builder (copied from seed script) ==========

type Team = {
  id: string;
  name: string;
  code?: string;
  groupId?: string;
};

const WC2026_TEAMS_BY_GROUP: Record<string, [string, string, string, string]> = {
  A: ["México", "Corea del Sur", "Sudáfrica", "TBD (Playoff Europa D)"],
  B: ["Canadá", "Qatar", "Suiza", "TBD (Playoff Europa A)"],
  C: ["Brasil", "Haití", "Marruecos", "Escocia"],
  D: ["Estados Unidos", "Australia", "Paraguay", "TBD (Playoff Europa C)"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Países Bajos", "Japón", "Túnez", "TBD (Playoff Europa B)"],
  G: ["Irán", "Nueva Zelanda", "Bélgica", "Chile"],
  H: ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"],
  I: ["Francia", "Senegal", "Noruega", "TBD (Playoff Intercontinental 2)"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Uzbekistán", "Colombia", "TBD (Playoff Intercontinental 1)"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panamá"],
};

function buildWc2026SandboxData() {
  const groups = "ABCDEFGHIJKL".split("");
  const teamsPerGroup = 4;

  const teams: Team[] = [];
  for (const g of groups) {
    const groupTeams = WC2026_TEAMS_BY_GROUP[g];
    if (!groupTeams) continue;

    for (let i = 1; i <= teamsPerGroup; i++) {
      teams.push({
        id: `t_${g}${i}`,
        name: groupTeams[i - 1]!,
        code: `${g}${i}`,
        groupId: g,
      });
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

  // Group stage matches
  for (const g of groups) {
    const t = (n: number) => `t_${g}${n}`;
    for (let k = 0; k < pairings.length; k++) {
      const p = pairings[k]!;
      matches.push({
        id: `m_${g}_${p.round}_${k + 1}`,
        phaseId: "group_stage",
        kickoffUtc: new Date(kickoff).toISOString(),
        matchNumber,
        roundLabel: `Grupo ${g} - J${p.round}`,
        venue: `Estadio ${(matchNumber % 16) + 1}`,
        groupId: g,
        homeTeamId: t(p.a),
        awayTeamId: t(p.b),
      });
      kickoff += twoHours;
      matchNumber++;
    }
  }

  // Knockout stages
  kickoff += 3 * 24 * 60 * 60 * 1000;

  // R32
  for (let i = 1; i <= 16; i++) {
    matches.push({
      id: `m_R32_${i}`,
      phaseId: "round_of_32",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber: matchNumber++,
      roundLabel: `R32 - Partido ${i}`,
      venue: `Estadio ${(i % 16) + 1}`,
      homeTeamId: `W_G${String.fromCharCode(64 + ((i - 1) % 12) + 1)}`,
      awayTeamId: `RU_G${String.fromCharCode(64 + ((i + 5) % 12) + 1)}`,
    });
    kickoff += twoHours;
  }

  // R16
  kickoff += 2 * 24 * 60 * 60 * 1000;
  for (let i = 1; i <= 8; i++) {
    matches.push({
      id: `m_R16_${i}`,
      phaseId: "round_of_16",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber: matchNumber++,
      roundLabel: `Octavos - Partido ${i}`,
      venue: `Estadio ${(i % 16) + 1}`,
      homeTeamId: `W_R32_${i * 2 - 1}`,
      awayTeamId: `W_R32_${i * 2}`,
    });
    kickoff += twoHours;
  }

  // QF
  kickoff += 2 * 24 * 60 * 60 * 1000;
  for (let i = 1; i <= 4; i++) {
    matches.push({
      id: `m_QF_${i}`,
      phaseId: "quarter_finals",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber: matchNumber++,
      roundLabel: `Cuartos - Partido ${i}`,
      venue: `Estadio ${(i % 16) + 1}`,
      homeTeamId: `W_R16_${i * 2 - 1}`,
      awayTeamId: `W_R16_${i * 2}`,
    });
    kickoff += twoHours;
  }

  // SF
  kickoff += 2 * 24 * 60 * 60 * 1000;
  for (let i = 1; i <= 2; i++) {
    matches.push({
      id: `m_SF_${i}`,
      phaseId: "semi_finals",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber: matchNumber++,
      roundLabel: `Semifinal ${i}`,
      venue: `Estadio Final`,
      homeTeamId: `W_QF_${i * 2 - 1}`,
      awayTeamId: `W_QF_${i * 2}`,
    });
    kickoff += twoHours;
  }

  // Finals
  kickoff += 2 * 24 * 60 * 60 * 1000;
  matches.push({
    id: "m_3RD",
    phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(),
    matchNumber: matchNumber++,
    roundLabel: "Tercer Lugar",
    venue: "Estadio Final",
    homeTeamId: "L_SF_1",
    awayTeamId: "L_SF_2",
  });
  kickoff += twoHours;
  matches.push({
    id: "m_FINAL",
    phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(),
    matchNumber: matchNumber++,
    roundLabel: "Final",
    venue: "Estadio Final",
    homeTeamId: "W_SF_1",
    awayTeamId: "W_SF_2",
  });

  return {
    meta: { name: "World Cup 2026 (Sandbox)", competition: "FIFA World Cup", seasonYear: 2026, sport: "football" },
    teams,
    phases,
    matches,
  };
}
