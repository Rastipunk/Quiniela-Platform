/**
 * Seed script: UEFA Champions League 2025-26 (Fase Knockout completa)
 *
 * Estructura: Dieciseisavos → Octavos → Cuartos → Semifinales → Final
 * - Dieciseisavos: equipos y fixture IDs reales de API-Football (Feb 17-25)
 * - Octavos a Final: placeholders (sorteo el 27 Feb 2026)
 * - Todas las rondas son ida y vuelta EXCEPTO la Final (partido único)
 * - Final: 30 May 2026, Puskás Aréna, Budapest
 *
 * Ejecutar: npx tsx src/scripts/seedUcl2025.ts
 */

import "dotenv/config";
import { prisma } from "../db";

// ============================================================================
// IDs
// ============================================================================
const TEMPLATE_ID = "ucl-2025-template";
const VERSION_ID = "ucl-2025-version";
const INSTANCE_ID = "ucl-2025-instance";

// ============================================================================
// TEAM DATA — nombres completos + logos de API-Football
// ============================================================================

interface TeamData {
  id: string;
  name: string;
  shortName: string;
  country: string;
  flag: string;
  apiFootballId?: number;
  logoUrl?: string;
}

const LOGO = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

// --- Dieciseisavos de Final (posiciones 9-24 de la fase de liga) ---
const R32_TEAMS: TeamData[] = [
  { id: "t_GAL", name: "Galatasaray", shortName: "GAL", country: "Turkey", flag: "🇹🇷", apiFootballId: 645, logoUrl: LOGO(645) },
  { id: "t_JUV", name: "Juventus", shortName: "JUV", country: "Italy", flag: "🇮🇹", apiFootballId: 496, logoUrl: LOGO(496) },
  { id: "t_MON", name: "Monaco", shortName: "MON", country: "France", flag: "🇫🇷", apiFootballId: 91, logoUrl: LOGO(91) },
  { id: "t_PSG", name: "Paris Saint-Germain", shortName: "PSG", country: "France", flag: "🇫🇷", apiFootballId: 85, logoUrl: LOGO(85) },
  { id: "t_BVB", name: "Borussia Dortmund", shortName: "BVB", country: "Germany", flag: "🇩🇪", apiFootballId: 165, logoUrl: LOGO(165) },
  { id: "t_ATA", name: "Atalanta", shortName: "ATA", country: "Italy", flag: "🇮🇹", apiFootballId: 499, logoUrl: LOGO(499) },
  { id: "t_BEN", name: "Benfica", shortName: "BEN", country: "Portugal", flag: "🇵🇹", apiFootballId: 211, logoUrl: LOGO(211) },
  { id: "t_RMA", name: "Real Madrid", shortName: "RMA", country: "Spain", flag: "🇪🇸", apiFootballId: 541, logoUrl: LOGO(541) },
  { id: "t_QAR", name: "Qarabağ", shortName: "QAR", country: "Azerbaijan", flag: "🇦🇿", apiFootballId: 556, logoUrl: LOGO(556) },
  { id: "t_NEW", name: "Newcastle United", shortName: "NEW", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 34, logoUrl: LOGO(34) },
  { id: "t_BOD", name: "Bodø/Glimt", shortName: "BOD", country: "Norway", flag: "🇳🇴", apiFootballId: 327, logoUrl: LOGO(327) },
  { id: "t_INT", name: "Inter Milan", shortName: "INT", country: "Italy", flag: "🇮🇹", apiFootballId: 505, logoUrl: LOGO(505) },
  { id: "t_OLY", name: "Olympiacos", shortName: "OLY", country: "Greece", flag: "🇬🇷", apiFootballId: 553, logoUrl: LOGO(553) },
  { id: "t_LEV", name: "Bayer Leverkusen", shortName: "LEV", country: "Germany", flag: "🇩🇪", apiFootballId: 168, logoUrl: LOGO(168) },
  { id: "t_BRU", name: "Club Brugge", shortName: "BRU", country: "Belgium", flag: "🇧🇪", apiFootballId: 569, logoUrl: LOGO(569) },
  { id: "t_ATM", name: "Atlético de Madrid", shortName: "ATM", country: "Spain", flag: "🇪🇸", apiFootballId: 530, logoUrl: LOGO(530) },
];

// --- Top 8 fase de liga (directo a Octavos como cabezas de serie) ---
const TOP8_TEAMS: TeamData[] = [
  { id: "t_ARS", name: "Arsenal", shortName: "ARS", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 42, logoUrl: LOGO(42) },
  { id: "t_BAY", name: "Bayern München", shortName: "BAY", country: "Germany", flag: "🇩🇪", apiFootballId: 157, logoUrl: LOGO(157) },
  { id: "t_LIV", name: "Liverpool", shortName: "LIV", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 40, logoUrl: LOGO(40) },
  { id: "t_TOT", name: "Tottenham Hotspur", shortName: "TOT", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 47, logoUrl: LOGO(47) },
  { id: "t_BAR", name: "FC Barcelona", shortName: "BAR", country: "Spain", flag: "🇪🇸", apiFootballId: 529, logoUrl: LOGO(529) },
  { id: "t_CHE", name: "Chelsea", shortName: "CHE", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 49, logoUrl: LOGO(49) },
  { id: "t_SPO", name: "Sporting CP", shortName: "SPO", country: "Portugal", flag: "🇵🇹", apiFootballId: 228, logoUrl: LOGO(228) },
  { id: "t_MCI", name: "Manchester City", shortName: "MCI", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", apiFootballId: 50, logoUrl: LOGO(50) },
];

// --- TBD placeholder ---
const TBD_TEAM: TeamData = {
  id: "t_TBD",
  name: "Por Definir",
  shortName: "TBD",
  country: "",
  flag: "❓",
};

const ALL_TEAMS = [...R32_TEAMS, ...TOP8_TEAMS, TBD_TEAM];

// ============================================================================
// R32 TIES — fixture IDs reales de API-Football
// ============================================================================

interface TieData {
  tieNumber: number;
  teamA: string; // home in leg 1
  teamB: string; // away in leg 1 (home in leg 2)
  leg1: { fixtureId: number; kickoffUtc: string };
  leg2: { fixtureId: number; kickoffUtc: string };
}

const R32_TIES: TieData[] = [
  {
    tieNumber: 1, teamA: "t_GAL", teamB: "t_JUV",
    leg1: { fixtureId: 1515514, kickoffUtc: "2026-02-17T17:45:00Z" },
    leg2: { fixtureId: 1515527, kickoffUtc: "2026-02-25T20:00:00Z" },
  },
  {
    tieNumber: 2, teamA: "t_MON", teamB: "t_PSG",
    leg1: { fixtureId: 1515517, kickoffUtc: "2026-02-17T20:00:00Z" },
    leg2: { fixtureId: 1515528, kickoffUtc: "2026-02-25T20:00:00Z" },
  },
  {
    tieNumber: 3, teamA: "t_BVB", teamB: "t_ATA",
    leg1: { fixtureId: 1515516, kickoffUtc: "2026-02-17T20:00:00Z" },
    leg2: { fixtureId: 1515526, kickoffUtc: "2026-02-25T17:45:00Z" },
  },
  {
    tieNumber: 4, teamA: "t_BEN", teamB: "t_RMA",
    leg1: { fixtureId: 1515515, kickoffUtc: "2026-02-17T20:00:00Z" },
    leg2: { fixtureId: 1515529, kickoffUtc: "2026-02-25T20:00:00Z" },
  },
  {
    tieNumber: 5, teamA: "t_QAR", teamB: "t_NEW",
    leg1: { fixtureId: 1515518, kickoffUtc: "2026-02-18T17:45:00Z" },
    leg2: { fixtureId: 1515525, kickoffUtc: "2026-02-24T20:00:00Z" },
  },
  {
    tieNumber: 6, teamA: "t_BOD", teamB: "t_INT",
    leg1: { fixtureId: 1515519, kickoffUtc: "2026-02-18T20:00:00Z" },
    leg2: { fixtureId: 1515524, kickoffUtc: "2026-02-24T20:00:00Z" },
  },
  {
    tieNumber: 7, teamA: "t_OLY", teamB: "t_LEV",
    leg1: { fixtureId: 1515521, kickoffUtc: "2026-02-18T20:00:00Z" },
    leg2: { fixtureId: 1515523, kickoffUtc: "2026-02-24T20:00:00Z" },
  },
  {
    tieNumber: 8, teamA: "t_BRU", teamB: "t_ATM",
    leg1: { fixtureId: 1515520, kickoffUtc: "2026-02-18T20:00:00Z" },
    leg2: { fixtureId: 1515522, kickoffUtc: "2026-02-24T17:45:00Z" },
  },
];

// ============================================================================
// BUILD COMPLETE TOURNAMENT DATA
// ============================================================================

function buildTemplateData() {
  // ----- PHASES -----
  const phases = [
    { id: "r32_leg1", name: "Dieciseisavos de Final - Ida", type: "KNOCKOUT_LEG", order: 1, twoLegged: true, legNumber: 1 },
    { id: "r32_leg2", name: "Dieciseisavos de Final - Vuelta", type: "KNOCKOUT_LEG", order: 2, twoLegged: true, legNumber: 2 },
    { id: "r16_leg1", name: "Octavos de Final - Ida", type: "KNOCKOUT_LEG", order: 3, twoLegged: true, legNumber: 1 },
    { id: "r16_leg2", name: "Octavos de Final - Vuelta", type: "KNOCKOUT_LEG", order: 4, twoLegged: true, legNumber: 2 },
    { id: "qf_leg1", name: "Cuartos de Final - Ida", type: "KNOCKOUT_LEG", order: 5, twoLegged: true, legNumber: 1 },
    { id: "qf_leg2", name: "Cuartos de Final - Vuelta", type: "KNOCKOUT_LEG", order: 6, twoLegged: true, legNumber: 2 },
    { id: "sf_leg1", name: "Semifinales - Ida", type: "KNOCKOUT_LEG", order: 7, twoLegged: true, legNumber: 1 },
    { id: "sf_leg2", name: "Semifinales - Vuelta", type: "KNOCKOUT_LEG", order: 8, twoLegged: true, legNumber: 2 },
    { id: "final", name: "Final", type: "KNOCKOUT_FINAL", order: 9, twoLegged: false, legNumber: 0 },
  ];

  // ----- MATCHES -----
  type MatchData = {
    id: string;
    phaseId: string;
    kickoffUtc: string;
    homeTeamId: string;
    awayTeamId: string;
    matchNumber: number;
    label: string;
    tieNumber?: number;
    leg?: number;
    status: "SCHEDULED" | "PLACEHOLDER";
  };

  const matches: MatchData[] = [];
  let seq = 1;

  const teamName = (id: string) => ALL_TEAMS.find((t) => t.id === id)?.name ?? id;

  // ---- R32 matches (real data) ----
  for (const tie of R32_TIES) {
    matches.push({
      id: `r32_${tie.tieNumber}_leg1`,
      phaseId: "r32_leg1",
      kickoffUtc: new Date(tie.leg1.kickoffUtc).toISOString(),
      homeTeamId: tie.teamA,
      awayTeamId: tie.teamB,
      matchNumber: seq++,
      label: `${teamName(tie.teamA)} vs ${teamName(tie.teamB)}`,
      tieNumber: tie.tieNumber,
      leg: 1,
      status: "SCHEDULED",
    });
    matches.push({
      id: `r32_${tie.tieNumber}_leg2`,
      phaseId: "r32_leg2",
      kickoffUtc: new Date(tie.leg2.kickoffUtc).toISOString(),
      homeTeamId: tie.teamB,
      awayTeamId: tie.teamA,
      matchNumber: seq++,
      label: `${teamName(tie.teamB)} vs ${teamName(tie.teamA)}`,
      tieNumber: tie.tieNumber,
      leg: 2,
      status: "SCHEDULED",
    });
  }

  // ---- R16 placeholder matches (8 ties × 2 legs) ----
  // Draw: Feb 27, 2026. Seeded (top 8) vs Dieciseisavos winners.
  // Dates: Leg 1 Mar 3-4, Leg 2 Mar 10-11
  const r16Leg1Dates = [
    "2026-03-03T20:00:00Z", "2026-03-03T20:00:00Z",
    "2026-03-03T20:00:00Z", "2026-03-03T20:00:00Z",
    "2026-03-04T20:00:00Z", "2026-03-04T20:00:00Z",
    "2026-03-04T20:00:00Z", "2026-03-04T20:00:00Z",
  ];
  const r16Leg2Dates = [
    "2026-03-10T20:00:00Z", "2026-03-10T20:00:00Z",
    "2026-03-10T20:00:00Z", "2026-03-10T20:00:00Z",
    "2026-03-11T20:00:00Z", "2026-03-11T20:00:00Z",
    "2026-03-11T20:00:00Z", "2026-03-11T20:00:00Z",
  ];

  for (let i = 1; i <= 8; i++) {
    matches.push({
      id: `r16_${i}_leg1`, phaseId: "r16_leg1",
      kickoffUtc: r16Leg1Dates[i - 1],
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Octavos - Llave ${i} (Ida)`,
      tieNumber: i, leg: 1, status: "PLACEHOLDER",
    });
    matches.push({
      id: `r16_${i}_leg2`, phaseId: "r16_leg2",
      kickoffUtc: r16Leg2Dates[i - 1],
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Octavos - Llave ${i} (Vuelta)`,
      tieNumber: i, leg: 2, status: "PLACEHOLDER",
    });
  }

  // ---- QF placeholder matches (4 ties × 2 legs) ----
  // Dates: Leg 1 Apr 7-8, Leg 2 Apr 14-15
  const qfLeg1Dates = ["2026-04-07T20:00:00Z", "2026-04-07T20:00:00Z", "2026-04-08T20:00:00Z", "2026-04-08T20:00:00Z"];
  const qfLeg2Dates = ["2026-04-14T20:00:00Z", "2026-04-14T20:00:00Z", "2026-04-15T20:00:00Z", "2026-04-15T20:00:00Z"];

  for (let i = 1; i <= 4; i++) {
    matches.push({
      id: `qf_${i}_leg1`, phaseId: "qf_leg1",
      kickoffUtc: qfLeg1Dates[i - 1],
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Cuartos - Llave ${i} (Ida)`,
      tieNumber: i, leg: 1, status: "PLACEHOLDER",
    });
    matches.push({
      id: `qf_${i}_leg2`, phaseId: "qf_leg2",
      kickoffUtc: qfLeg2Dates[i - 1],
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Cuartos - Llave ${i} (Vuelta)`,
      tieNumber: i, leg: 2, status: "PLACEHOLDER",
    });
  }

  // ---- SF placeholder matches (2 ties × 2 legs) ----
  // Dates: Leg 1 Apr 28-29, Leg 2 May 5-6
  for (let i = 1; i <= 2; i++) {
    matches.push({
      id: `sf_${i}_leg1`, phaseId: "sf_leg1",
      kickoffUtc: i === 1 ? "2026-04-28T20:00:00Z" : "2026-04-29T20:00:00Z",
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Semifinal ${i} (Ida)`,
      tieNumber: i, leg: 1, status: "PLACEHOLDER",
    });
    matches.push({
      id: `sf_${i}_leg2`, phaseId: "sf_leg2",
      kickoffUtc: i === 1 ? "2026-05-05T20:00:00Z" : "2026-05-06T20:00:00Z",
      homeTeamId: "t_TBD", awayTeamId: "t_TBD",
      matchNumber: seq++,
      label: `Semifinal ${i} (Vuelta)`,
      tieNumber: i, leg: 2, status: "PLACEHOLDER",
    });
  }

  // ---- Final (single match in Budapest) ----
  matches.push({
    id: "final", phaseId: "final",
    kickoffUtc: "2026-05-30T19:00:00Z",
    homeTeamId: "t_TBD", awayTeamId: "t_TBD",
    matchNumber: seq++,
    label: "Final - Budapest",
    status: "PLACEHOLDER",
  });

  // Sort by kickoff
  matches.sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

  // ----- ADVANCEMENT RULES -----
  const advancement = {
    description: "UCL 2025-26 Knockout: todas las rondas ida y vuelta excepto la Final",
    rules: [
      {
        from: "r32", to: "r16", method: "AGGREGATE",
        note: "Ganador por global (2 legs). Si empate en global: prórroga + penales en vuelta. Ganadores emparejados con cabezas de serie por sorteo (27 Feb).",
      },
      {
        from: "r16", to: "qf", method: "AGGREGATE",
        note: "Ganador por global (2 legs). Si empate: prórroga + penales en vuelta.",
      },
      {
        from: "qf", to: "sf", method: "AGGREGATE",
        note: "Ganador por global (2 legs). Si empate: prórroga + penales en vuelta.",
      },
      {
        from: "sf", to: "final", method: "AGGREGATE",
        note: "Ganador por global (2 legs). Si empate: prórroga + penales en vuelta.",
      },
      {
        from: "final", to: null, method: "SINGLE_MATCH",
        note: "Partido único en Puskás Aréna, Budapest. Si empate: prórroga + penales.",
      },
    ],
    seededTeams: TOP8_TEAMS.map((t) => ({ id: t.id, name: t.name })),
  };

  return {
    meta: {
      name: "UEFA Champions League 2025-26",
      competition: "UEFA Champions League",
      seasonYear: 2025,
      sport: "football",
      format: "KNOCKOUT_TWO_LEGGED",
      venue: { final: "Puskás Aréna, Budapest" },
    },
    teams: ALL_TEAMS.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      code: t.shortName,
      country: t.country,
      flag: t.flag,
      logoUrl: t.logoUrl ?? null,
      apiFootballId: t.apiFootballId ?? null,
    })),
    phases,
    matches,
    advancement,
  };
}

// ============================================================================
// SEED
// ============================================================================

async function seedUcl2025() {
  console.log("🏆 Seed: UEFA Champions League 2025-26 (Knockout completo)\n");

  const templateData = buildTemplateData();
  const scheduledMatches = templateData.matches.filter((m) => m.status === "SCHEDULED");
  const placeholderMatches = templateData.matches.filter((m) => m.status === "PLACEHOLDER");

  // 1. Template
  console.log("📋 Template...");
  const template = await prisma.tournamentTemplate.upsert({
    where: { id: TEMPLATE_ID },
    update: {
      name: "UEFA Champions League 2025-26",
      description: "Champions League 2025-26 - Fase Knockout (Dieciseisavos a Final)",
    },
    create: {
      id: TEMPLATE_ID,
      key: "ucl-2025",
      name: "UEFA Champions League 2025-26",
      description: "Champions League 2025-26 - Fase Knockout (Dieciseisavos a Final)",
    },
  });
  console.log(`   ✓ ${template.name}`);

  // 2. Version
  console.log("📦 Versión...");
  const version = await prisma.tournamentTemplateVersion.upsert({
    where: { id: VERSION_ID },
    update: { dataJson: templateData as any, status: "PUBLISHED" },
    create: {
      id: VERSION_ID,
      templateId: template.id,
      versionNumber: 1,
      dataJson: templateData as any,
      status: "PUBLISHED",
      publishedAtUtc: new Date(),
    },
  });
  await prisma.tournamentTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id },
  });
  console.log("   ✓ Publicada");

  // 3. Instance (AUTO mode)
  console.log("🎮 Instancia (modo AUTO)...");
  const instance = await prisma.tournamentInstance.upsert({
    where: { id: INSTANCE_ID },
    update: {
      name: "Champions League 2025-26",
      dataJson: templateData as any,
      resultSourceMode: "AUTO",
      apiFootballLeagueId: 2,
      apiFootballSeasonId: 2025,
      syncEnabled: true,
      status: "ACTIVE",
    },
    create: {
      id: INSTANCE_ID,
      templateId: template.id,
      templateVersionId: version.id,
      name: "Champions League 2025-26",
      dataJson: templateData as any,
      resultSourceMode: "AUTO",
      apiFootballLeagueId: 2,
      apiFootballSeasonId: 2025,
      syncEnabled: true,
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ ${instance.name} (AUTO, League: 2, Season: 2025)`);

  // 4. Fixture mappings (Dieciseisavos)
  console.log("🔗 Mapeos de fixtures (Dieciseisavos)...");
  await prisma.matchExternalMapping.deleteMany({
    where: { tournamentInstanceId: INSTANCE_ID },
  });

  let mappingCount = 0;
  for (const tie of R32_TIES) {
    await prisma.matchExternalMapping.create({
      data: {
        tournamentInstanceId: INSTANCE_ID,
        internalMatchId: `r32_${tie.tieNumber}_leg1`,
        apiFootballFixtureId: tie.leg1.fixtureId,
      },
    });
    await prisma.matchExternalMapping.create({
      data: {
        tournamentInstanceId: INSTANCE_ID,
        internalMatchId: `r32_${tie.tieNumber}_leg2`,
        apiFootballFixtureId: tie.leg2.fixtureId,
      },
    });
    mappingCount += 2;
  }
  console.log(`   ✓ ${mappingCount} mapeos (8 llaves × 2 legs)`);

  // 5. Smart Sync states (Dieciseisavos)
  console.log("🔄 Sync states (Dieciseisavos)...");
  await prisma.matchSyncState.deleteMany({
    where: { tournamentInstanceId: INSTANCE_ID },
  });

  let syncCount = 0;
  for (const match of scheduledMatches) {
    const kickoff = new Date(match.kickoffUtc);
    await prisma.matchSyncState.create({
      data: {
        tournamentInstanceId: INSTANCE_ID,
        internalMatchId: match.id,
        syncStatus: "PENDING",
        kickoffUtc: kickoff,
        firstCheckAtUtc: new Date(kickoff.getTime() + 5 * 60 * 1000),
        finishCheckAtUtc: new Date(kickoff.getTime() + 110 * 60 * 1000),
      },
    });
    syncCount++;
  }
  console.log(`   ✓ ${syncCount} sync states PENDING`);

  // ============================================================
  // RESUMEN
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED CHAMPIONS LEAGUE 2025-26 COMPLETADO");
  console.log("=".repeat(60));

  console.log(`\n📊 ESTRUCTURA:`);
  console.log(`   Equipos: ${ALL_TEAMS.length} (${R32_TEAMS.length} dieciseisavos + ${TOP8_TEAMS.length} cabezas de serie + TBD)`);
  console.log(`   Fases: ${templateData.phases.length}`);
  for (const p of templateData.phases) {
    const count = templateData.matches.filter((m) => m.phaseId === p.id).length;
    console.log(`     - ${p.name}: ${count} partidos`);
  }
  console.log(`   Partidos: ${templateData.matches.length} total (${scheduledMatches.length} programados + ${placeholderMatches.length} por definir)`);
  console.log(`   Mapeos: ${mappingCount} | Sync states: ${syncCount}`);

  console.log(`\n📅 DIECISEISAVOS - IDA:`);
  for (const tie of R32_TIES) {
    const a = ALL_TEAMS.find((t) => t.id === tie.teamA)!;
    const b = ALL_TEAMS.find((t) => t.id === tie.teamB)!;
    const d = new Date(tie.leg1.kickoffUtc);
    console.log(`   ${a.name} vs ${b.name} | ${d.toISOString().slice(0, 16)} UTC | #${tie.leg1.fixtureId}`);
  }
  console.log(`\n📅 DIECISEISAVOS - VUELTA:`);
  for (const tie of R32_TIES) {
    const a = ALL_TEAMS.find((t) => t.id === tie.teamA)!;
    const b = ALL_TEAMS.find((t) => t.id === tie.teamB)!;
    const d = new Date(tie.leg2.kickoffUtc);
    console.log(`   ${b.name} vs ${a.name} | ${d.toISOString().slice(0, 16)} UTC | #${tie.leg2.fixtureId}`);
  }

  console.log(`\n🏟️ CABEZAS DE SERIE (directo a Octavos):`);
  for (const t of TOP8_TEAMS) {
    console.log(`   ${t.flag} ${t.name}`);
  }

  console.log(`\n🔑 Instance ID: ${INSTANCE_ID}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

seedUcl2025()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
