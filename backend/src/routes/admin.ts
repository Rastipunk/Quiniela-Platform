import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { prisma } from "../db";
import { templateDataSchema, validateTemplateDataConsistency } from "../schemas/templateData";

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

// Endpoint público para crear admin inicial (solo funciona si no hay admins)
// NOTA: Este endpoint NO tiene requireAuth - es público intencionalmente
adminRouter.post("/bootstrap-admin", async (req, res) => {
  console.log("[bootstrap-admin] Request received");
  try {
    // Check if any admin exists
    const existingAdmin = await prisma.user.findFirst({
      where: { platformRole: "ADMIN" },
    });

    if (existingAdmin) {
      return res.status(400).json({ ok: false, error: "Ya existe un admin. Este endpoint está deshabilitado." });
    }

    const { email, password, displayName, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y password son requeridos" });
    }

    // Import hash function
    const { hash } = await import("bcrypt");
    const passwordHash = await hash(password, 10);

    // Generate username from email if not provided
    const adminUsername = username || email.split("@")[0] + "_admin";

    const admin = await prisma.user.create({
      data: {
        email,
        username: adminUsername,
        displayName: displayName || "Admin",
        passwordHash,
        platformRole: "ADMIN",
      },
    });

    res.json({ ok: true, message: "Admin creado", userId: admin.id });
  } catch (error: any) {
    console.error("Error creating admin:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
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
