/**
 * Script para agregar fases knockout a la instancia WC2022 Auto-Test
 */

import { prisma } from "../db";

// WC2022 Knockout Fixtures (IDs reales de API-Football)
const KNOCKOUT_MATCHES = {
  round_of_16: [
    { id: "ko_r16_1", home: "t_NED", away: "t_USA", fixtureId: 855767, label: "Netherlands vs USA" },
    { id: "ko_r16_2", home: "t_ARG", away: "t_AUS", fixtureId: 855768, label: "Argentina vs Australia" },
    { id: "ko_r16_3", home: "t_FRA", away: "t_POL", fixtureId: 855769, label: "France vs Poland" },
    { id: "ko_r16_4", home: "t_ENG", away: "t_SEN", fixtureId: 855770, label: "England vs Senegal" },
    { id: "ko_r16_5", home: "t_JPN", away: "t_CRO", fixtureId: 855771, label: "Japan vs Croatia" },
    { id: "ko_r16_6", home: "t_BRA", away: "t_KOR", fixtureId: 855772, label: "Brazil vs South Korea" },
    { id: "ko_r16_7", home: "t_MAR", away: "t_ESP", fixtureId: 855773, label: "Morocco vs Spain" },
    { id: "ko_r16_8", home: "t_POR", away: "t_SUI", fixtureId: 855774, label: "Portugal vs Switzerland" },
  ],
  quarter_finals: [
    { id: "ko_qf_1", home: "t_CRO", away: "t_BRA", fixtureId: 855775, label: "Croatia vs Brazil" },
    { id: "ko_qf_2", home: "t_NED", away: "t_ARG", fixtureId: 855776, label: "Netherlands vs Argentina" },
    { id: "ko_qf_3", home: "t_MAR", away: "t_POR", fixtureId: 855777, label: "Morocco vs Portugal" },
    { id: "ko_qf_4", home: "t_ENG", away: "t_FRA", fixtureId: 855778, label: "England vs France" },
  ],
  semi_finals: [
    { id: "ko_sf_1", home: "t_ARG", away: "t_CRO", fixtureId: 855779, label: "Argentina vs Croatia" },
    { id: "ko_sf_2", home: "t_FRA", away: "t_MAR", fixtureId: 855780, label: "France vs Morocco" },
  ],
  third_place: [
    { id: "ko_3rd", home: "t_CRO", away: "t_MAR", fixtureId: 855781, label: "Croatia vs Morocco" },
  ],
  final: [
    { id: "ko_final", home: "t_ARG", away: "t_FRA", fixtureId: 855782, label: "Argentina vs France" },
  ],
};

const KNOCKOUT_PHASES = [
  { id: "round_of_16", name: "Round of 16", phaseName: "Octavos de Final", offset: 0 },
  { id: "quarter_finals", name: "Quarter Finals", phaseName: "Cuartos de Final", offset: 5 },
  { id: "semi_finals", name: "Semi Finals", phaseName: "Semifinales", offset: 10 },
  { id: "third_place", name: "Third Place", phaseName: "Tercer Puesto", offset: 15 },
  { id: "final", name: "Final", phaseName: "Final", offset: 15 },
];

async function addKnockoutPhases() {
  console.log("🏆 Agregando fases knockout a WC2022 Auto-Test...\n");

  // 1. Obtener la instancia actual
  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: "wc2022-autotest-instance" },
  });

  if (!instance) {
    throw new Error("Instance not found");
  }

  const dataJson = instance.dataJson as {
    phases: Array<{ id: string; name: string; type?: string }>;
    matches: Array<{
      id: string;
      phaseId: string;
      homeTeamId: string;
      awayTeamId: string;
      kickoffUtc: string;
      label?: string;
    }>;
  };

  // Base time: después de Jornada 3 (2:00) + 5 min = 2:05 PM
  const baseKnockoutTime = new Date("2026-02-06T14:05:00");

  // 2. Agregar phases si no existen
  for (const phase of KNOCKOUT_PHASES) {
    if (!dataJson.phases.find((p) => p.id === phase.id)) {
      dataJson.phases.push({
        id: phase.id,
        name: phase.name,
        type: "knockout",
      });
    }
  }

  // 3. Agregar matches
  const newMatches: typeof dataJson.matches = [];
  const newMappings: Array<{ internalMatchId: string; apiFootballFixtureId: number }> = [];

  for (const [phaseId, matches] of Object.entries(KNOCKOUT_MATCHES)) {
    const phaseConfig = KNOCKOUT_PHASES.find((p) => p.id === phaseId)!;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const kickoff = new Date(baseKnockoutTime.getTime() + (phaseConfig.offset + i) * 60 * 1000);

      // Solo agregar si no existe
      if (!dataJson.matches.find((m) => m.id === match.id)) {
        newMatches.push({
          id: match.id,
          phaseId: phaseId,
          homeTeamId: match.home,
          awayTeamId: match.away,
          kickoffUtc: kickoff.toISOString(),
          label: match.label,
        });
      }

      newMappings.push({
        internalMatchId: match.id,
        apiFootballFixtureId: match.fixtureId,
      });
    }
  }

  // Agregar nuevos matches al dataJson
  dataJson.matches.push(...newMatches);

  // 4. Actualizar instancia
  await prisma.tournamentInstance.update({
    where: { id: "wc2022-autotest-instance" },
    data: { dataJson: dataJson as any },
  });
  console.log(`✅ Instance dataJson actualizado con ${newMatches.length} nuevos partidos`);

  // 5. Crear mappings (con manejo de duplicados)
  let mappingsCreated = 0;
  for (const mapping of newMappings) {
    // Verificar si ya existe por internalMatchId
    const existing = await prisma.matchExternalMapping.findUnique({
      where: {
        tournamentInstanceId_internalMatchId: {
          tournamentInstanceId: "wc2022-autotest-instance",
          internalMatchId: mapping.internalMatchId,
        },
      },
    });

    if (existing) {
      // Ya existe, actualizar si es necesario
      if (existing.apiFootballFixtureId !== mapping.apiFootballFixtureId) {
        await prisma.matchExternalMapping.update({
          where: { id: existing.id },
          data: { apiFootballFixtureId: mapping.apiFootballFixtureId },
        });
      }
    } else {
      // No existe, crear
      try {
        await prisma.matchExternalMapping.create({
          data: {
            tournamentInstanceId: "wc2022-autotest-instance",
            internalMatchId: mapping.internalMatchId,
            apiFootballFixtureId: mapping.apiFootballFixtureId,
          },
        });
        mappingsCreated++;
      } catch (e) {
        // Ignorar si ya existe por fixtureId (duplicado)
        console.log(`   ⚠️ Mapping para ${mapping.internalMatchId} ya existe o duplicado`);
      }
    }
  }
  console.log(`✅ Creados ${mappingsCreated} nuevos mappings`);

  // 6. Crear picks para los nuevos partidos
  const users = await prisma.user.findMany({
    where: { email: { contains: "autotest" } },
  });

  let picksCreated = 0;
  for (const user of users) {
    for (const match of newMatches) {
      const homeGoals = Math.floor(Math.random() * 4);
      const awayGoals = Math.floor(Math.random() * 4);

      await prisma.prediction.upsert({
        where: {
          poolId_userId_matchId: {
            poolId: "wc2022-autotest-pool",
            userId: user.id,
            matchId: match.id,
          },
        },
        create: {
          poolId: "wc2022-autotest-pool",
          userId: user.id,
          matchId: match.id,
          pickJson: { type: "SCORE", homeGoals, awayGoals },
        },
        update: {
          pickJson: { type: "SCORE", homeGoals, awayGoals },
        },
      });
      picksCreated++;
    }
  }
  console.log(`✅ Creados ${picksCreated} picks para knockout`);

  // 7. Actualizar pickTypesConfig del pool
  const pool = await prisma.pool.findUnique({ where: { id: "wc2022-autotest-pool" } });
  const pickTypesConfig = (pool?.pickTypesConfig as any[]) || [];

  for (const phase of KNOCKOUT_PHASES) {
    if (!pickTypesConfig.find((p) => p.phaseId === phase.id)) {
      pickTypesConfig.push({
        phaseId: phase.id,
        phaseName: phase.phaseName,
        requiresScore: true,
        matchPickTypes: {
          MATCH_OUTCOME_90MIN: { enabled: true, points: 5 },
          HOME_GOALS: { enabled: true, points: 2 },
          AWAY_GOALS: { enabled: true, points: 2 },
          GOAL_DIFFERENCE: { enabled: true, points: 1 },
        },
      });
    }
  }

  await prisma.pool.update({
    where: { id: "wc2022-autotest-pool" },
    data: { pickTypesConfig },
  });
  console.log("✅ Pool pickTypesConfig actualizado");

  // 8. Mostrar resumen
  console.log("\n📅 HORARIO KNOCKOUT:");
  console.log("   Round of 16:     10:35 PM (8 partidos)");
  console.log("   Quarter Finals:  10:40 PM (4 partidos)");
  console.log("   Semi Finals:     10:45 PM (2 partidos)");
  console.log("   3rd Place/Final: 10:50 PM (2 partidos)");

  const totalMatches = await prisma.matchExternalMapping.count({
    where: { tournamentInstanceId: "wc2022-autotest-instance" },
  });
  console.log(`\n📊 Total partidos mapeados: ${totalMatches}`);
}

addKnockoutPhases()
  .then(() => {
    console.log("\n✅ KNOCKOUT PHASES AGREGADAS");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
