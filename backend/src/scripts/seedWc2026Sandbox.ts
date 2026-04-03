// backend/src/scripts/seedWc2026Sandbox.ts
import "dotenv/config";
import { prisma } from "../db";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";

type Team = {
  id: string;
  name: string;
  code?: string;
  groupId?: string;
  apiFootballId?: number;
};

type Match = {
  id: string;
  phaseId: string;
  kickoffUtc: string;
  matchNumber: number;
  roundLabel?: string;
  venue?: string;
  groupId?: string;
  homeTeamId: string;
  awayTeamId: string;
};

// ============================================================================
// EQUIPOS OFICIALES — FIFA World Cup 2026
// Fuente: API-Football (api-sports.io) league=1, season=2026
// Verificado: 2026-04-03
// ============================================================================

const WC2026_GROUPS: Record<string, Array<{ name: string; code: string; apiId: number }>> = {
  A: [
    { name: "México", code: "MEX", apiId: 16 },
    { name: "Corea del Sur", code: "KOR", apiId: 17 },
    { name: "Sudáfrica", code: "RSA", apiId: 1531 },
    { name: "República Checa", code: "CZE", apiId: 770 },
  ],
  B: [
    { name: "Canadá", code: "CAN", apiId: 5529 },
    { name: "Qatar", code: "QAT", apiId: 1569 },
    { name: "Suiza", code: "SUI", apiId: 15 },
    { name: "Bosnia y Herzegovina", code: "BIH", apiId: 1113 },
  ],
  C: [
    { name: "Brasil", code: "BRA", apiId: 6 },
    { name: "Haití", code: "HAI", apiId: 2386 },
    { name: "Marruecos", code: "MAR", apiId: 31 },
    { name: "Escocia", code: "SCO", apiId: 1108 },
  ],
  D: [
    { name: "Estados Unidos", code: "USA", apiId: 2384 },
    { name: "Australia", code: "AUS", apiId: 20 },
    { name: "Paraguay", code: "PAR", apiId: 2380 },
    { name: "Turquía", code: "TUR", apiId: 777 },
  ],
  E: [
    { name: "Alemania", code: "GER", apiId: 25 },
    { name: "Curazao", code: "CUW", apiId: 5530 },
    { name: "Costa de Marfil", code: "CIV", apiId: 1501 },
    { name: "Ecuador", code: "ECU", apiId: 2382 },
  ],
  F: [
    { name: "Países Bajos", code: "NED", apiId: 1118 },
    { name: "Japón", code: "JPN", apiId: 12 },
    { name: "Túnez", code: "TUN", apiId: 28 },
    { name: "Suecia", code: "SWE", apiId: 5 },
  ],
  G: [
    { name: "Bélgica", code: "BEL", apiId: 1 },
    { name: "Egipto", code: "EGY", apiId: 32 },
    { name: "Irán", code: "IRN", apiId: 22 },
    { name: "Nueva Zelanda", code: "NZL", apiId: 4673 },
  ],
  H: [
    { name: "España", code: "ESP", apiId: 9 },
    { name: "Cabo Verde", code: "CPV", apiId: 1533 },
    { name: "Arabia Saudita", code: "KSA", apiId: 23 },
    { name: "Uruguay", code: "URU", apiId: 7 },
  ],
  I: [
    { name: "Francia", code: "FRA", apiId: 2 },
    { name: "Senegal", code: "SEN", apiId: 13 },
    { name: "Noruega", code: "NOR", apiId: 1090 },
    { name: "Irak", code: "IRQ", apiId: 1567 },
  ],
  J: [
    { name: "Argentina", code: "ARG", apiId: 26 },
    { name: "Argelia", code: "ALG", apiId: 1532 },
    { name: "Austria", code: "AUT", apiId: 775 },
    { name: "Jordania", code: "JOR", apiId: 1548 },
  ],
  K: [
    { name: "Portugal", code: "POR", apiId: 27 },
    { name: "Uzbekistán", code: "UZB", apiId: 1568 },
    { name: "Colombia", code: "COL", apiId: 8 },
    { name: "R.D. del Congo", code: "COD", apiId: 1508 },
  ],
  L: [
    { name: "Inglaterra", code: "ENG", apiId: 10 },
    { name: "Croacia", code: "CRO", apiId: 3 },
    { name: "Ghana", code: "GHA", apiId: 1504 },
    { name: "Panamá", code: "PAN", apiId: 11 },
  ],
};

// ============================================================================
// FIXTURES OFICIALES — Fase de Grupos (72 partidos)
// Fuente: API-Football fixtures?league=1&season=2026
// Formato: [fixtureId, "kickoffUtc", homeApiId, awayApiId, "venue"]
// ============================================================================

type FixtureRow = [number, string, number, number, string];

const GROUP_FIXTURES: Record<string, FixtureRow[]> = {
  A: [
    // Matchday 1
    [1489369, "2026-06-11T19:00:00+00:00", 16, 1531, "Estadio Azteca"],
    [1538999, "2026-06-12T02:00:00+00:00", 17, 770, "Estadio Akron"],
    // Matchday 2
    [1539004, "2026-06-18T16:00:00+00:00", 770, 1531, "Mercedes-Benz Stadium"],
    [1489388, "2026-06-19T01:00:00+00:00", 16, 17, "Estadio Akron"],
    // Matchday 3
    [1539010, "2026-06-25T01:00:00+00:00", 770, 16, "Estadio Azteca"],
    [1489407, "2026-06-25T01:00:00+00:00", 1531, 17, "Estadio BBVA"],
  ],
  B: [
    [1539000, "2026-06-12T19:00:00+00:00", 5529, 1113, "BMO Field"],
    [1489373, "2026-06-13T19:00:00+00:00", 1569, 15, "TBD"],
    [1539005, "2026-06-18T19:00:00+00:00", 15, 1113, "SoFi Stadium"],
    [1489387, "2026-06-18T22:00:00+00:00", 5529, 1569, "BC Place"],
    [1489408, "2026-06-24T19:00:00+00:00", 15, 5529, "BC Place"],
    [1539009, "2026-06-24T19:00:00+00:00", 1113, 1569, "Lumen Field"],
  ],
  C: [
    [1489371, "2026-06-13T22:00:00+00:00", 6, 31, "MetLife Stadium"],
    [1489372, "2026-06-14T01:00:00+00:00", 2386, 1108, "Gillette Stadium"],
    [1489390, "2026-06-19T22:00:00+00:00", 1108, 31, "Gillette Stadium"],
    [1489389, "2026-06-20T01:00:00+00:00", 6, 2386, "Lincoln Financial Field"],
    [1489405, "2026-06-24T22:00:00+00:00", 31, 2386, "Mercedes-Benz Stadium"],
    [1489406, "2026-06-24T22:00:00+00:00", 1108, 6, "Hard Rock Stadium"],
  ],
  D: [
    [1489370, "2026-06-13T01:00:00+00:00", 2384, 2380, "SoFi Stadium"],
    [1539001, "2026-06-14T04:00:00+00:00", 20, 777, "BC Place"],
    [1539006, "2026-06-19T04:00:00+00:00", 777, 2380, "TBD"],
    [1489391, "2026-06-19T19:00:00+00:00", 2384, 20, "Lumen Field"],
    [1539012, "2026-06-26T02:00:00+00:00", 777, 2384, "SoFi Stadium"],
    [1489411, "2026-06-26T02:00:00+00:00", 2380, 20, "TBD"],
  ],
  E: [
    [1489374, "2026-06-14T17:00:00+00:00", 25, 5530, "NRG Stadium"],
    [1489375, "2026-06-14T23:00:00+00:00", 1501, 2382, "Lincoln Financial Field"],
    [1489393, "2026-06-20T20:00:00+00:00", 25, 1501, "BMO Field"],
    [1489392, "2026-06-21T00:00:00+00:00", 2382, 5530, "Arrowhead Stadium"],
    [1489410, "2026-06-25T20:00:00+00:00", 2382, 25, "MetLife Stadium"],
    [1489409, "2026-06-25T20:00:00+00:00", 5530, 1501, "Lincoln Financial Field"],
  ],
  F: [
    [1489376, "2026-06-14T20:00:00+00:00", 1118, 12, "TBD"],
    [1539002, "2026-06-15T02:00:00+00:00", 5, 28, "Estadio BBVA"],
    [1489394, "2026-06-20T04:00:00+00:00", 28, 12, "Estadio BBVA"],
    [1539007, "2026-06-20T17:00:00+00:00", 1118, 5, "NRG Stadium"],
    [1539011, "2026-06-25T23:00:00+00:00", 12, 5, "TBD"],
    [1489412, "2026-06-25T23:00:00+00:00", 28, 1118, "Arrowhead Stadium"],
  ],
  G: [
    [1489377, "2026-06-15T19:00:00+00:00", 1, 32, "Lumen Field"],
    [1489378, "2026-06-16T01:00:00+00:00", 22, 4673, "SoFi Stadium"],
    [1489395, "2026-06-21T19:00:00+00:00", 1, 22, "SoFi Stadium"],
    [1489396, "2026-06-22T01:00:00+00:00", 4673, 32, "BC Place"],
    [1489414, "2026-06-27T03:00:00+00:00", 32, 22, "Lumen Field"],
    [1489415, "2026-06-27T03:00:00+00:00", 4673, 1, "BC Place"],
  ],
  H: [
    [1489380, "2026-06-15T16:00:00+00:00", 9, 1533, "Mercedes-Benz Stadium"],
    [1489379, "2026-06-15T22:00:00+00:00", 23, 7, "Hard Rock Stadium"],
    [1489397, "2026-06-21T16:00:00+00:00", 9, 23, "Mercedes-Benz Stadium"],
    [1489398, "2026-06-21T22:00:00+00:00", 7, 1533, "Hard Rock Stadium"],
    [1489417, "2026-06-27T00:00:00+00:00", 7, 9, "Estadio Akron"],
    [1489413, "2026-06-27T00:00:00+00:00", 1533, 23, "NRG Stadium"],
  ],
  I: [
    [1489383, "2026-06-16T19:00:00+00:00", 2, 13, "MetLife Stadium"],
    [1539016, "2026-06-16T22:00:00+00:00", 1567, 1090, "TBD"],
    [1539017, "2026-06-22T21:00:00+00:00", 2, 1567, "TBD"],
    [1489401, "2026-06-23T00:00:00+00:00", 1090, 13, "MetLife Stadium"],
    [1539074, "2026-06-26T19:00:00+00:00", 13, 1567, "TBD"],
    [1489416, "2026-06-26T19:00:00+00:00", 1090, 2, "Gillette Stadium"],
  ],
  J: [
    [1489382, "2026-06-16T04:00:00+00:00", 775, 1548, "TBD"],
    [1489381, "2026-06-17T01:00:00+00:00", 26, 1532, "Arrowhead Stadium"],
    [1489399, "2026-06-22T17:00:00+00:00", 26, 775, "TBD"],
    [1489400, "2026-06-23T03:00:00+00:00", 1548, 1532, "TBD"],
    [1489418, "2026-06-28T02:00:00+00:00", 1532, 775, "Arrowhead Stadium"],
    [1489421, "2026-06-28T02:00:00+00:00", 1548, 26, "TBD"],
  ],
  K: [
    [1539003, "2026-06-17T17:00:00+00:00", 27, 1508, "NRG Stadium"],
    [1489386, "2026-06-18T02:00:00+00:00", 1568, 8, "Estadio Azteca"],
    [1489404, "2026-06-23T17:00:00+00:00", 27, 1568, "NRG Stadium"],
    [1539008, "2026-06-24T02:00:00+00:00", 8, 1508, "Estadio Akron"],
    [1489419, "2026-06-27T23:30:00+00:00", 8, 27, "Hard Rock Stadium"],
    [1539013, "2026-06-27T23:30:00+00:00", 1508, 1568, "Mercedes-Benz Stadium"],
  ],
  L: [
    [1489384, "2026-06-17T20:00:00+00:00", 10, 3, "TBD"],
    [1489385, "2026-06-17T23:00:00+00:00", 1504, 11, "BMO Field"],
    [1489402, "2026-06-23T20:00:00+00:00", 10, 1504, "Gillette Stadium"],
    [1489403, "2026-06-23T23:00:00+00:00", 11, 3, "BMO Field"],
    [1489420, "2026-06-27T21:00:00+00:00", 3, 1504, "Lincoln Financial Field"],
    [1489422, "2026-06-27T21:00:00+00:00", 11, 10, "MetLife Stadium"],
  ],
};

// ============================================================================
// BUILD FUNCTION
// ============================================================================

function buildWc2026SandboxData() {
  const groups = "ABCDEFGHIJKL".split("");

  // --- Teams ---
  const teams: Team[] = [];
  // Reverse lookup: apiFootballId → internal team ID
  const apiIdToTeamId: Record<number, string> = {};

  for (const g of groups) {
    const groupTeams = WC2026_GROUPS[g];
    if (!groupTeams) continue;

    for (let i = 0; i < groupTeams.length; i++) {
      const t = groupTeams[i]!;
      const teamId = `t_${g}${i + 1}`;
      teams.push({
        id: teamId,
        name: t.name,
        code: t.code,
        groupId: g,
        apiFootballId: t.apiId,
      });
      apiIdToTeamId[t.apiId] = teamId;
    }
  }

  // --- Phases ---
  const phases = [
    {
      id: "group_stage",
      name: "Fase de Grupos",
      type: "GROUP" as const,
      order: 1,
      config: { groupsCount: 12, teamsPerGroup: 4 },
    },
    {
      id: "round_of_32",
      name: "Dieciseisavos de Final",
      type: "KNOCKOUT" as const,
      order: 2,
      config: { matchesCount: 16 },
    },
    {
      id: "round_of_16",
      name: "Octavos de Final",
      type: "KNOCKOUT" as const,
      order: 3,
      config: { matchesCount: 8 },
    },
    {
      id: "quarter_finals",
      name: "Cuartos de Final",
      type: "KNOCKOUT" as const,
      order: 4,
      config: { matchesCount: 4 },
    },
    {
      id: "semi_finals",
      name: "Semifinales",
      type: "KNOCKOUT" as const,
      order: 5,
      config: { matchesCount: 2 },
    },
    {
      id: "finals",
      name: "Final",
      type: "KNOCKOUT" as const,
      order: 6,
      config: { matchesCount: 2 }, // 3rd place + final
    },
  ];

  // --- Group Stage Matches (from real API fixtures) ---
  const matches: Match[] = [];
  // Also build fixture mapping for later DB insertion
  const fixtureMapping: Array<{ internalMatchId: string; apiFootballFixtureId: number }> = [];

  let matchNumber = 1;
  let matchIndex = 0; // per group, for unique match IDs

  for (const g of groups) {
    const fixtures = GROUP_FIXTURES[g];
    if (!fixtures) continue;

    for (let i = 0; i < fixtures.length; i++) {
      const [fixtureId, kickoffRaw, homeApiId, awayApiId, venue] = fixtures[i]!;

      const homeTeamId = apiIdToTeamId[homeApiId];
      const awayTeamId = apiIdToTeamId[awayApiId];

      if (!homeTeamId || !awayTeamId) {
        throw new Error(
          `Cannot map API team IDs for Group ${g} fixture ${fixtureId}: ` +
          `home=${homeApiId} → ${homeTeamId}, away=${awayApiId} → ${awayTeamId}`
        );
      }

      // Determine matchday (1-based): fixtures are ordered MD1(2), MD2(2), MD3(2)
      const matchday = Math.floor(i / 2) + 1;

      // Normalize kickoff to ISO 8601 UTC
      const kickoffUtc = new Date(kickoffRaw).toISOString();

      const matchId = `m_${g}_MD${matchday}_${(i % 2) + 1}`;

      matches.push({
        id: matchId,
        phaseId: "group_stage",
        kickoffUtc,
        matchNumber,
        roundLabel: `Grupo ${g} - Jornada ${matchday}`,
        venue: venue !== "TBD" ? venue : undefined,
        groupId: g,
        homeTeamId,
        awayTeamId,
      });

      fixtureMapping.push({
        internalMatchId: matchId,
        apiFootballFixtureId: fixtureId,
      });

      matchNumber++;
    }
  }

  // ========== KNOCKOUT STAGES (placeholders) ==========
  // Official FIFA WC 2026 bracket — Match numbers 73-104
  // Source: fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026
  // Third-place teams use 3rd_POOL_N (ranked 1-8). Actual allocation
  // depends on which 8 groups qualify thirds (FIFA Annex C, 495 scenarios).
  // In AUTO mode, knockout fixtures are synced from API when available.

  // Round of 32 — 16 matches (FIFA #73-88)
  const r32Matchups: Array<{ home: string; away: string; label: string; venue?: string }> = [
    // Match 73 (m_R32_1)
    { home: "RU_A", away: "RU_B", label: "2A vs 2B", venue: "SoFi Stadium" },
    // Match 74 (m_R32_2)
    { home: "W_E", away: "3rd_POOL_1", label: "1E vs 3er Lugar", venue: "Gillette Stadium" },
    // Match 75 (m_R32_3)
    { home: "W_F", away: "RU_C", label: "1F vs 2C", venue: "Estadio BBVA" },
    // Match 76 (m_R32_4)
    { home: "W_C", away: "RU_F", label: "1C vs 2F", venue: "NRG Stadium" },
    // Match 77 (m_R32_5)
    { home: "W_I", away: "3rd_POOL_2", label: "1I vs 3er Lugar", venue: "MetLife Stadium" },
    // Match 78 (m_R32_6)
    { home: "RU_E", away: "RU_I", label: "2E vs 2I", venue: "AT&T Stadium" },
    // Match 79 (m_R32_7)
    { home: "W_A", away: "3rd_POOL_3", label: "1A vs 3er Lugar", venue: "Estadio Azteca" },
    // Match 80 (m_R32_8)
    { home: "W_L", away: "3rd_POOL_4", label: "1L vs 3er Lugar", venue: "Mercedes-Benz Stadium" },
    // Match 81 (m_R32_9)
    { home: "W_D", away: "3rd_POOL_5", label: "1D vs 3er Lugar", venue: "Levi's Stadium" },
    // Match 82 (m_R32_10)
    { home: "W_G", away: "3rd_POOL_6", label: "1G vs 3er Lugar", venue: "Lumen Field" },
    // Match 83 (m_R32_11)
    { home: "RU_K", away: "RU_L", label: "2K vs 2L", venue: "BMO Field" },
    // Match 84 (m_R32_12)
    { home: "W_H", away: "RU_J", label: "1H vs 2J", venue: "SoFi Stadium" },
    // Match 85 (m_R32_13)
    { home: "W_B", away: "3rd_POOL_7", label: "1B vs 3er Lugar", venue: "BC Place" },
    // Match 86 (m_R32_14)
    { home: "W_J", away: "RU_H", label: "1J vs 2H", venue: "Hard Rock Stadium" },
    // Match 87 (m_R32_15)
    { home: "W_K", away: "3rd_POOL_8", label: "1K vs 3er Lugar", venue: "Arrowhead Stadium" },
    // Match 88 (m_R32_16)
    { home: "RU_D", away: "RU_G", label: "2D vs 2G", venue: "AT&T Stadium" },
  ];

  // Placeholder kickoff times for knockout (real times come from API sync)
  // R32 starts Jun 28 per FIFA schedule; actual times resolved via PhaseSyncJob
  let knockoutKickoff = new Date("2026-06-28T18:00:00Z").getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  for (let i = 0; i < r32Matchups.length; i++) {
    const m = r32Matchups[i]!;
    matches.push({
      id: `m_R32_${i + 1}`,
      phaseId: "round_of_32",
      kickoffUtc: new Date(knockoutKickoff).toISOString(),
      matchNumber,
      roundLabel: `R32 - ${m.label}`,
      venue: m.venue,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    knockoutKickoff += twoHours;
    matchNumber++;
  }

  // Round of 16 — 8 matches (FIFA #89-96)
  // Bracket paths follow FIFA official connections
  const r16Matchups: Array<{ home: string; away: string; venue?: string }> = [
    // FIFA #89: W(74=R32_2) vs W(77=R32_5)
    { home: "W_R32_2", away: "W_R32_5", venue: "Lincoln Financial Field" },
    // FIFA #90: W(73=R32_1) vs W(75=R32_3)
    { home: "W_R32_1", away: "W_R32_3", venue: "NRG Stadium" },
    // FIFA #91: W(76=R32_4) vs W(78=R32_6)
    { home: "W_R32_4", away: "W_R32_6", venue: "MetLife Stadium" },
    // FIFA #92: W(79=R32_7) vs W(80=R32_8)
    { home: "W_R32_7", away: "W_R32_8", venue: "Estadio Azteca" },
    // FIFA #93: W(83=R32_11) vs W(84=R32_12)
    { home: "W_R32_11", away: "W_R32_12", venue: "AT&T Stadium" },
    // FIFA #94: W(81=R32_9) vs W(82=R32_10)
    { home: "W_R32_9", away: "W_R32_10", venue: "Lumen Field" },
    // FIFA #95: W(86=R32_14) vs W(88=R32_16)
    { home: "W_R32_14", away: "W_R32_16", venue: "Mercedes-Benz Stadium" },
    // FIFA #96: W(85=R32_13) vs W(87=R32_15)
    { home: "W_R32_13", away: "W_R32_15", venue: "BC Place" },
  ];

  knockoutKickoff += 2 * 24 * 60 * 60 * 1000; // +2 days

  for (let i = 0; i < r16Matchups.length; i++) {
    const m = r16Matchups[i]!;
    matches.push({
      id: `m_R16_${i + 1}`,
      phaseId: "round_of_16",
      kickoffUtc: new Date(knockoutKickoff).toISOString(),
      matchNumber,
      roundLabel: `Octavos - Partido ${i + 1}`,
      venue: m.venue,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    knockoutKickoff += twoHours;
    matchNumber++;
  }

  // Quarter-finals — 4 matches (FIFA #97-100)
  const qfMatchups: Array<{ home: string; away: string; venue?: string }> = [
    // FIFA #97: W(89=R16_1) vs W(90=R16_2)
    { home: "W_R16_1", away: "W_R16_2", venue: "Gillette Stadium" },
    // FIFA #98: W(93=R16_5) vs W(94=R16_6)
    { home: "W_R16_5", away: "W_R16_6", venue: "SoFi Stadium" },
    // FIFA #99: W(91=R16_3) vs W(92=R16_4)
    { home: "W_R16_3", away: "W_R16_4", venue: "Hard Rock Stadium" },
    // FIFA #100: W(95=R16_7) vs W(96=R16_8)
    { home: "W_R16_7", away: "W_R16_8", venue: "Arrowhead Stadium" },
  ];

  knockoutKickoff += 2 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < qfMatchups.length; i++) {
    const m = qfMatchups[i]!;
    matches.push({
      id: `m_QF_${i + 1}`,
      phaseId: "quarter_finals",
      kickoffUtc: new Date(knockoutKickoff).toISOString(),
      matchNumber,
      roundLabel: `Cuartos - Partido ${i + 1}`,
      venue: m.venue,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    knockoutKickoff += twoHours;
    matchNumber++;
  }

  // Semi-finals — 2 matches (FIFA #101-102)
  const sfMatchups: Array<{ home: string; away: string; venue?: string }> = [
    // FIFA #101: W(97=QF_1) vs W(98=QF_2)
    { home: "W_QF_1", away: "W_QF_2", venue: "AT&T Stadium" },
    // FIFA #102: W(99=QF_3) vs W(100=QF_4)
    { home: "W_QF_3", away: "W_QF_4", venue: "Mercedes-Benz Stadium" },
  ];

  knockoutKickoff += 2 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < sfMatchups.length; i++) {
    const m = sfMatchups[i]!;
    matches.push({
      id: `m_SF_${i + 1}`,
      phaseId: "semi_finals",
      kickoffUtc: new Date(knockoutKickoff).toISOString(),
      matchNumber,
      roundLabel: `Semifinal ${i + 1}`,
      venue: m.venue,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    knockoutKickoff += twoHours;
    matchNumber++;
  }

  // Finals — 2 matches (FIFA #103-104)
  knockoutKickoff += 2 * 24 * 60 * 60 * 1000;

  // 3rd place match (FIFA #103)
  matches.push({
    id: "m_3RD",
    phaseId: "finals",
    kickoffUtc: new Date(knockoutKickoff).toISOString(),
    matchNumber,
    roundLabel: "Tercer Lugar",
    venue: "Hard Rock Stadium",
    homeTeamId: "L_SF_1",
    awayTeamId: "L_SF_2",
  });
  knockoutKickoff += twoHours;
  matchNumber++;

  // Final (FIFA #104)
  matches.push({
    id: "m_FINAL",
    phaseId: "finals",
    kickoffUtc: new Date(knockoutKickoff).toISOString(),
    matchNumber,
    roundLabel: "Final",
    venue: "MetLife Stadium",
    homeTeamId: "W_SF_1",
    awayTeamId: "W_SF_2",
  });

  return {
    data: {
      meta: {
        name: "FIFA World Cup 2026",
        competition: "FIFA World Cup",
        seasonYear: 2026,
        sport: "football" as const,
      },
      teams,
      phases,
      matches,
    },
    fixtureMapping,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const key = "wc_2026_sandbox";
  const templateName = "FIFA World Cup 2026";
  const instanceName = "WC 2026 (Sandbox Instance)";
  const now = new Date();

  // 1) Build + validate data
  const { data: raw, fixtureMapping } = buildWc2026SandboxData();
  const parsed = templateDataSchema.parse(raw);
  const issues = validateTemplateDataConsistency(parsed);
  if (issues.length) {
    throw new Error(`TemplateData inconsistente:\n- ${issues.join("\n- ")}`);
  }

  console.log(`✅ Validación pasó: ${parsed.teams.length} equipos, ${parsed.matches.length} partidos`);

  // 2) Upsert template
  const template = await prisma.tournamentTemplate.upsert({
    where: { key },
    update: { name: templateName, status: "PUBLISHED" },
    create: { key, name: templateName, status: "PUBLISHED" },
  });

  // 3) Create next version (published)
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
      dataJson: parsed,
    },
  });

  await prisma.tournamentTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id, status: "PUBLISHED" },
  });

  // 4) Create or update a single ACTIVE instance
  const existingInstance = await prisma.tournamentInstance.findFirst({
    where: { name: instanceName },
  });

  const instance = existingInstance
    ? await prisma.tournamentInstance.update({
        where: { id: existingInstance.id },
        data: {
          name: instanceName,
          status: "ACTIVE",
          templateId: template.id,
          templateVersionId: version.id,
          dataJson: parsed,
          // Configure for API-Football auto sync
          resultSourceMode: "AUTO",
          apiFootballLeagueId: 1,    // World Cup
          apiFootballSeasonId: 2026,
          syncEnabled: true,
        },
      })
    : await prisma.tournamentInstance.create({
        data: {
          name: instanceName,
          status: "ACTIVE",
          templateId: template.id,
          templateVersionId: version.id,
          dataJson: parsed,
          resultSourceMode: "AUTO",
          apiFootballLeagueId: 1,
          apiFootballSeasonId: 2026,
          syncEnabled: true,
        },
      });

  // 5) Create MatchExternalMapping for group stage fixtures
  console.log(`📎 Creando ${fixtureMapping.length} match mappings...`);

  // Delete existing mappings for this instance
  await prisma.matchExternalMapping.deleteMany({
    where: { tournamentInstanceId: instance.id },
  });

  // Create new mappings
  for (const mapping of fixtureMapping) {
    // Find home/away API IDs from fixture data
    let homeApiId: number | undefined;
    let awayApiId: number | undefined;

    for (const g of Object.keys(GROUP_FIXTURES)) {
      for (const row of GROUP_FIXTURES[g]!) {
        if (row[0] === mapping.apiFootballFixtureId) {
          homeApiId = row[2];
          awayApiId = row[3];
          break;
        }
      }
      if (homeApiId) break;
    }

    await prisma.matchExternalMapping.create({
      data: {
        tournamentInstanceId: instance.id,
        internalMatchId: mapping.internalMatchId,
        apiFootballFixtureId: mapping.apiFootballFixtureId,
        apiFootballHomeTeamId: homeApiId ?? null,
        apiFootballAwayTeamId: awayApiId ?? null,
      },
    });
  }

  // 6) Initialize MatchSyncState for group stage
  console.log(`⏱️ Inicializando sync states...`);

  await prisma.matchSyncState.deleteMany({
    where: { tournamentInstanceId: instance.id },
  });

  for (const mapping of fixtureMapping) {
    const match = parsed.matches.find((m: any) => m.id === mapping.internalMatchId);
    if (!match) continue;

    const kickoffUtc = new Date(match.kickoffUtc);
    const firstCheckAt = new Date(kickoffUtc.getTime() + 5 * 60 * 1000); // +5 min
    const finishCheckAt = new Date(kickoffUtc.getTime() + 110 * 60 * 1000); // +110 min

    await prisma.matchSyncState.create({
      data: {
        tournamentInstanceId: instance.id,
        internalMatchId: mapping.internalMatchId,
        syncStatus: "PENDING",
        kickoffUtc,
        firstCheckAtUtc: firstCheckAt,
        finishCheckAtUtc: finishCheckAt,
      },
    });
  }

  console.log("✅ WC2026 Sandbox listo:");
  console.log("  templateId =", template.id);
  console.log("  versionId  =", version.id, "versionNumber =", nextVersionNumber);
  console.log("  instanceId =", instance.id);
  console.log("  resultSourceMode = AUTO (API-Football league=1, season=2026)");
  console.log(`  ${fixtureMapping.length} match mappings creados`);
  console.log(`  ${fixtureMapping.length} sync states inicializados`);
}

main()
  .catch((e) => {
    console.error("❌ seedWc2026Sandbox failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
