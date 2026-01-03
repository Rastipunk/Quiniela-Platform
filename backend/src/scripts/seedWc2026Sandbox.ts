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

function buildWc2026SandboxData() {
  const groups = "ABCDEFGHIJKL".split(""); // 12 grupos
  const teamsPerGroup = 4;

  const teams: Team[] = [];
  for (const g of groups) {
    for (let i = 1; i <= teamsPerGroup; i++) {
      teams.push({
        id: `t_${g}${i}`,
        name: `Equipo ${g}${i}`,
        // code lo usaremos después para banderas (mapping a ISO2/FIFA)
        code: `${g}${i}`, // placeholder estable por ahora
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
