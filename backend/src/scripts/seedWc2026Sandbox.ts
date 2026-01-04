// backend/src/scripts/seedWc2026Sandbox.ts
import "dotenv/config";
import { prisma } from "../db";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";

type Team = {
  id: string;
  name: string;
  code?: string;
  groupId?: string;
};

// Mapeo de equipos reales del Mundial 2026 (basado en sorteo del 5 de diciembre de 2025)
// Fuente: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026
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
  const groups = "ABCDEFGHIJKL".split(""); // 12 grupos
  const teamsPerGroup = 4;

  const teams: Team[] = [];
  for (const g of groups) {
    const groupTeams = WC2026_TEAMS_BY_GROUP[g];
    if (!groupTeams) continue; // Safeguard (no debería pasar)

    for (let i = 1; i <= teamsPerGroup; i++) {
      teams.push({
        id: `t_${g}${i}`,
        name: groupTeams[i - 1], // Nombre real del país
        code: `${g}${i}`, // Código para mapeo de banderas
        groupId: g,
      });
    }
  }

  const phases = [
    {
      id: "group_stage",
      name: "Fase de Grupos",
      type: "GROUP",
      order: 1,
      config: { groupsCount: 12, teamsPerGroup: 4 },
    },
    {
      id: "round_of_32",
      name: "Dieciseisavos de Final",
      type: "KNOCKOUT",
      order: 2,
      config: { matchesCount: 16 },
    },
    {
      id: "round_of_16",
      name: "Octavos de Final",
      type: "KNOCKOUT",
      order: 3,
      config: { matchesCount: 8 },
    },
    {
      id: "quarter_finals",
      name: "Cuartos de Final",
      type: "KNOCKOUT",
      order: 4,
      config: { matchesCount: 4 },
    },
    {
      id: "semi_finals",
      name: "Semifinales",
      type: "KNOCKOUT",
      order: 5,
      config: { matchesCount: 2 },
    },
    {
      id: "finals",
      name: "Final",
      type: "KNOCKOUT",
      order: 6,
      config: { matchesCount: 2 }, // 3rd place + final
    },
  ];

  // Round robin por grupo (6 partidos):
  // J1: 1v2, 3v4
  // J2: 1v3, 2v4
  // J3: 1v4, 2v3
  const pairings = [
    { round: 1, a: 1, b: 2 },
    { round: 1, a: 3, b: 4 },
    { round: 2, a: 1, b: 3 },
    { round: 2, a: 2, b: 4 },
    { round: 3, a: 1, b: 4 },
    { round: 3, a: 2, b: 3 },
  ];

  // Fechas: no necesitamos el calendario real aún, solo volumen.
  // Empezamos 2026-06-11 18:00Z y vamos sumando 2 horas por partido.
  let kickoff = new Date("2026-06-11T18:00:00Z").getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  let matchNumber = 1;

  const matches = [];
  for (const g of groups) {
    const t = (n: number) => `t_${g}${n}`;

    for (let k = 0; k < pairings.length; k++) {
      const p = pairings[k];

      const matchId = `m_${g}_${p.round}_${k + 1}`; // <= 50 chars
      const kickoffUtc = new Date(kickoff).toISOString();
      kickoff += twoHours;

      matches.push({
        id: matchId,
        phaseId: "group_stage",
        kickoffUtc,
        matchNumber,
        roundLabel: `Grupo ${g} - J${p.round}`,
        venue: `Estadio ${(matchNumber % 16) + 1}`,
        groupId: g,
        homeTeamId: t(p.a),
        awayTeamId: t(p.b),
      });

      matchNumber++;
    }
  }

  // ========== KNOCKOUT STAGES ==========

  // Round of 32 (16 matches)
  // Formato FIFA 2026: Winners + Best 8 third-place teams
  const r32Matchups = [
    // Upper half
    { home: "W_A", away: "3rd_POOL_1", label: "1A vs 3er Lugar" },
    { home: "W_C", away: "3rd_POOL_2", label: "1C vs 3er Lugar" },
    { home: "W_E", away: "3rd_POOL_3", label: "1E vs 3er Lugar" },
    { home: "W_G", away: "3rd_POOL_4", label: "1G vs 3er Lugar" },
    { home: "W_B", away: "3rd_POOL_5", label: "1B vs 3er Lugar" },
    { home: "W_D", away: "3rd_POOL_6", label: "1D vs 3er Lugar" },
    { home: "W_F", away: "3rd_POOL_7", label: "1F vs 3er Lugar" },
    { home: "W_H", away: "3rd_POOL_8", label: "1H vs 3er Lugar" },
    // Lower half (runners-up)
    { home: "W_I", away: "RU_J", label: "1I vs 2J" },
    { home: "W_K", away: "RU_L", label: "1K vs 2L" },
    { home: "W_J", away: "RU_I", label: "1J vs 2I" },
    { home: "W_L", away: "RU_K", label: "1L vs 2K" },
    { home: "RU_A", away: "RU_B", label: "2A vs 2B" },
    { home: "RU_C", away: "RU_D", label: "2C vs 2D" },
    { home: "RU_E", away: "RU_F", label: "2E vs 2F" },
    { home: "RU_G", away: "RU_H", label: "2G vs 2H" },
  ];

  // Añadir 3 días después del último partido de grupos para R32
  kickoff += 3 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < r32Matchups.length; i++) {
    const m = r32Matchups[i]!;
    matches.push({
      id: `m_R32_${i + 1}`,
      phaseId: "round_of_32",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber,
      roundLabel: `R32 - Partido ${i + 1}`,
      venue: `Estadio ${(matchNumber % 16) + 1}`,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    kickoff += twoHours;
    matchNumber++;
  }

  // Round of 16 (8 matches)
  const r16Matchups = [
    { home: "W_R32_1", away: "W_R32_2" },
    { home: "W_R32_3", away: "W_R32_4" },
    { home: "W_R32_5", away: "W_R32_6" },
    { home: "W_R32_7", away: "W_R32_8" },
    { home: "W_R32_9", away: "W_R32_10" },
    { home: "W_R32_11", away: "W_R32_12" },
    { home: "W_R32_13", away: "W_R32_14" },
    { home: "W_R32_15", away: "W_R32_16" },
  ];

  kickoff += 2 * 24 * 60 * 60 * 1000; // +2 días

  for (let i = 0; i < r16Matchups.length; i++) {
    const m = r16Matchups[i]!;
    matches.push({
      id: `m_R16_${i + 1}`,
      phaseId: "round_of_16",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber,
      roundLabel: `Octavos - Partido ${i + 1}`,
      venue: `Estadio ${(matchNumber % 16) + 1}`,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    kickoff += twoHours;
    matchNumber++;
  }

  // Quarter-finals (4 matches)
  const qfMatchups = [
    { home: "W_R16_1", away: "W_R16_2" },
    { home: "W_R16_3", away: "W_R16_4" },
    { home: "W_R16_5", away: "W_R16_6" },
    { home: "W_R16_7", away: "W_R16_8" },
  ];

  kickoff += 2 * 24 * 60 * 60 * 1000; // +2 días

  for (let i = 0; i < qfMatchups.length; i++) {
    const m = qfMatchups[i]!;
    matches.push({
      id: `m_QF_${i + 1}`,
      phaseId: "quarter_finals",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber,
      roundLabel: `Cuartos - Partido ${i + 1}`,
      venue: `Estadio ${(matchNumber % 16) + 1}`,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    kickoff += twoHours;
    matchNumber++;
  }

  // Semi-finals (2 matches)
  const sfMatchups = [
    { home: "W_QF_1", away: "W_QF_2" },
    { home: "W_QF_3", away: "W_QF_4" },
  ];

  kickoff += 2 * 24 * 60 * 60 * 1000; // +2 días

  for (let i = 0; i < sfMatchups.length; i++) {
    const m = sfMatchups[i]!;
    matches.push({
      id: `m_SF_${i + 1}`,
      phaseId: "semi_finals",
      kickoffUtc: new Date(kickoff).toISOString(),
      matchNumber,
      roundLabel: `Semifinal ${i + 1}`,
      venue: `Estadio ${(matchNumber % 16) + 1}`,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    kickoff += twoHours;
    matchNumber++;
  }

  // Finals (3rd place + Final)
  kickoff += 2 * 24 * 60 * 60 * 1000; // +2 días

  // 3rd place match
  matches.push({
    id: "m_3RD",
    phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(),
    matchNumber,
    roundLabel: "Tercer Lugar",
    venue: "Estadio Final",
    homeTeamId: "L_SF_1",
    awayTeamId: "L_SF_2",
  });
  kickoff += twoHours;
  matchNumber++;

  // Final
  matches.push({
    id: "m_FINAL",
    phaseId: "finals",
    kickoffUtc: new Date(kickoff).toISOString(),
    matchNumber,
    roundLabel: "Final",
    venue: "Estadio Final",
    homeTeamId: "W_SF_1",
    awayTeamId: "W_SF_2",
  });

  return {
    meta: {
      name: "World Cup 2026 (Sandbox)",
      competition: "FIFA World Cup",
      seasonYear: 2026,
      sport: "football",
    },
    teams,
    phases,
    matches,
  };
}

async function main() {
  const key = "wc_2026_sandbox";
  const templateName = "World Cup 2026 (Sandbox)";
  const instanceName = "WC 2026 (Sandbox Instance)";
  const now = new Date();

  // 1) Build + validate data
  const raw = buildWc2026SandboxData();
  const parsed = templateDataSchema.parse(raw);
  const issues = validateTemplateDataConsistency(parsed);
  if (issues.length) {
    throw new Error(`TemplateData inconsistente:\n- ${issues.join("\n- ")}`);
  }

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
        },
      })
    : await prisma.tournamentInstance.create({
        data: {
          name: instanceName,
          status: "ACTIVE",
          templateId: template.id,
          templateVersionId: version.id,
          dataJson: parsed,
        },
      });

  console.log("✅ WC2026 Sandbox listo:");
  console.log("  templateId =", template.id);
  console.log("  versionId  =", version.id, "versionNumber =", nextVersionNumber);
  console.log("  instanceId =", instance.id);
}

main()
  .catch((e) => {
    console.error("❌ seedWc2026Sandbox failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
