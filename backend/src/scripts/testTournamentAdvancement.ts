// backend/src/scripts/testTournamentAdvancement.ts
/**
 * Script de pruebas end-to-end para el sistema de avance automático de torneos.
 *
 * Este script:
 * 1. Crea una instancia de torneo WC2026 completa
 * 2. Crea una pool de prueba
 * 3. Simula resultados para todos los partidos de grupos
 * 4. Avanza de grupos a R32
 * 5. Simula resultados de R32
 * 6. Avanza a R16
 * 7. Y así sucesivamente hasta la final
 * 8. Verifica que todos los placeholders se resuelvan correctamente
 */

import { prisma } from "../db";
import { hashPassword } from "../lib/password";
import {
  advanceToRoundOf32,
  advanceKnockoutPhase,
  validateGroupStageComplete,
} from "../services/instanceAdvancement";

// Generar WC2026 template data
function generateWc2026TemplateData() {
  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  const teams = groups.flatMap((g, gi) =>
    [1, 2, 3, 4].map((pos) => ({
      id: `t_${g}${pos}`,
      name: `Team ${g}${pos}`,
      code: `${g}${pos}`,
      groupId: g,
    }))
  );

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

  const matches = [];
  let matchNumber = 1;
  let kickoff = new Date("2026-06-11T18:00:00.000Z").getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  // Group stage matches (72 total)
  const pairings = [
    { round: 1, a: 1, b: 2 },
    { round: 1, a: 3, b: 4 },
    { round: 2, a: 1, b: 3 },
    { round: 2, a: 2, b: 4 },
    { round: 3, a: 1, b: 4 },
    { round: 3, a: 2, b: 3 },
  ];

  for (const group of groups) {
    const t = (pos: number) => `t_${group}${pos}`;
    for (const p of pairings) {
      matches.push({
        id: `m_${group}_${p.round}_${p.a < p.b ? "1" : "2"}`,
        phaseId: "group_stage",
        kickoffUtc: new Date(kickoff).toISOString(),
        matchNumber,
        roundLabel: `Grupo ${group} - Jornada ${p.round}`,
        venue: `Estadio ${group}`,
        groupId: group,
        homeTeamId: t(p.a),
        awayTeamId: t(p.b),
      });
      kickoff += twoHours;
      matchNumber++;
    }
  }

  // Round of 32 (16 matches) - with placeholders
  const r32Matchups = [
    { home: "W_A", away: "3rd_POOL_1" },
    { home: "W_C", away: "3rd_POOL_2" },
    { home: "W_E", away: "3rd_POOL_3" },
    { home: "W_G", away: "3rd_POOL_4" },
    { home: "W_B", away: "3rd_POOL_5" },
    { home: "W_D", away: "3rd_POOL_6" },
    { home: "W_F", away: "3rd_POOL_7" },
    { home: "W_H", away: "3rd_POOL_8" },
    { home: "W_I", away: "RU_J" },
    { home: "W_K", away: "RU_L" },
    { home: "W_J", away: "RU_I" },
    { home: "W_L", away: "RU_K" },
    { home: "RU_A", away: "RU_B" },
    { home: "RU_C", away: "RU_D" },
    { home: "RU_E", away: "RU_F" },
    { home: "RU_G", away: "RU_H" },
  ];

  kickoff += 3 * 24 * 60 * 60 * 1000; // +3 days

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

  kickoff += 2 * 24 * 60 * 60 * 1000;

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

  kickoff += 2 * 24 * 60 * 60 * 1000;

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

  kickoff += 2 * 24 * 60 * 60 * 1000;

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
  kickoff += 2 * 24 * 60 * 60 * 1000;

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
      name: "World Cup 2026 (Test)",
      competition: "FIFA World Cup",
      seasonYear: 2026,
      sport: "football",
    },
    teams,
    phases,
    matches,
  };
}

// Helper function to publish a match result
async function publishMatchResult(
  poolId: string,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  adminId: string
) {
  // Buscar si ya existe
  let poolMatchResult = await prisma.poolMatchResult.findUnique({
    where: {
      poolId_matchId: {
        poolId,
        matchId,
      },
    },
  });

  // Si ya existe, limpiar versiones anteriores
  if (poolMatchResult) {
    await prisma.poolMatchResultVersion.deleteMany({
      where: { resultId: poolMatchResult.id },
    });
  } else {
    // Crear nuevo resultado
    poolMatchResult = await prisma.poolMatchResult.create({
      data: {
        poolId,
        matchId,
      },
    });
  }

  // Crear versión
  const resultVersion = await prisma.poolMatchResultVersion.create({
    data: {
      resultId: poolMatchResult.id,
      versionNumber: 1,
      status: "PUBLISHED",
      homeGoals,
      awayGoals,
      createdByUserId: adminId,
      publishedAtUtc: new Date(),
    },
  });

  // Actualizar currentVersionId
  await prisma.poolMatchResult.update({
    where: { id: poolMatchResult.id },
    data: { currentVersionId: resultVersion.id },
  });
}

async function main() {
  console.log("🧪 INICIANDO PRUEBAS AUTOMATIZADAS DE AVANCE DE TORNEO\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Crear usuario administrador de prueba
  console.log("👤 Paso 1: Creando usuario administrador...");
  const adminPassword = await hashPassword("test123");
  const admin = await prisma.user.upsert({
    where: { email: "admin-test@test.com" },
    update: {},
    create: {
      email: "admin-test@test.com",
      displayName: "Admin Test",
      passwordHash: adminPassword,
      platformRole: "ADMIN",
    },
  });
  console.log(`   ✅ Admin creado: ${admin.displayName} (${admin.email})\n`);

  // 2. Crear template y version
  console.log("📋 Paso 2: Creando tournament template...");
  const templateData = generateWc2026TemplateData();

  // Limpiar template anterior si existe
  const existingTemplate = await prisma.tournamentTemplate.findFirst({
    where: { key: "wc-2026-test" },
  });

  if (existingTemplate) {
    console.log("   🧹 Limpiando template anterior...");

    // Primero limpiar todas las pools asociadas a instancias de este template
    const instances = await prisma.tournamentInstance.findMany({
      where: { templateId: existingTemplate.id },
      select: { id: true },
    });

    for (const inst of instances) {
      const pools = await prisma.pool.findMany({
        where: { tournamentInstanceId: inst.id },
        select: { id: true },
      });

      for (const p of pools) {
        // Limpiar dependencias de cada pool
        const results = await prisma.poolMatchResult.findMany({
          where: { poolId: p.id },
          select: { id: true },
        });

        for (const r of results) {
          await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: r.id } });
        }

        await prisma.poolMatchResult.deleteMany({ where: { poolId: p.id } });
        await prisma.prediction.deleteMany({ where: { poolId: p.id } });
        await prisma.poolInvite.deleteMany({ where: { poolId: p.id } });
        await prisma.poolMember.deleteMany({ where: { poolId: p.id } });
        await prisma.pool.delete({ where: { id: p.id } });
      }
    }

    // Ahora podemos eliminar las instancias
    await prisma.tournamentInstance.deleteMany({
      where: { templateId: existingTemplate.id },
    });

    // Y finalmente el template y sus versiones
    await prisma.tournamentTemplateVersion.deleteMany({
      where: { templateId: existingTemplate.id },
    });
    await prisma.tournamentTemplate.delete({
      where: { id: existingTemplate.id },
    });
  }

  const template = await prisma.tournamentTemplate.create({
    data: {
      key: "wc-2026-test",
      name: "World Cup 2026 (Test Automatizado)",
      description: "Template de prueba para testing automatizado",
      status: "PUBLISHED",
    },
  });

  const version = await prisma.tournamentTemplateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      status: "PUBLISHED",
      dataJson: templateData,
    },
  });

  await prisma.tournamentTemplate.update({
    where: { id: template.id },
    data: { currentPublishedVersionId: version.id },
  });

  console.log(`   ✅ Template: ${template.name}`);
  console.log(`   ✅ Version: ${version.versionNumber} (${version.status})\n`);

  // 3. Crear instancia
  console.log("🏆 Paso 3: Creando tournament instance...");
  const instance = await prisma.tournamentInstance.create({
    data: {
      templateId: template.id,
      templateVersionId: version.id,
      name: "WC 2026 - Test Automatizado",
      status: "ACTIVE",
      dataJson: version.dataJson,
    },
  });
  console.log(`   ✅ Instance: ${instance.name} (${instance.status})\n`);

  // 4. Crear pool
  console.log("🎱 Paso 4: Creando pool de prueba...");

  // Limpiar TODAS las pools de prueba (no solo las del template actual)
  const existingPools = await prisma.pool.findMany({
    where: { name: "Test Pool - Automated" },
  });

  if (existingPools.length > 0) {
    console.log(`   🧹 Limpiando ${existingPools.length} pool(s) anterior(es)...`);
    for (const existingPool of existingPools) {
      // Obtener todos los results para limpiar versiones
      const existingResults = await prisma.poolMatchResult.findMany({
        where: { poolId: existingPool.id },
        select: { id: true },
      });

      // Eliminar versiones de resultados
      for (const r of existingResults) {
        await prisma.poolMatchResultVersion.deleteMany({ where: { resultId: r.id } });
      }

      // Eliminar en orden por dependencias
      await prisma.poolMatchResult.deleteMany({ where: { poolId: existingPool.id } });
      await prisma.prediction.deleteMany({ where: { poolId: existingPool.id } });
      await prisma.poolInvite.deleteMany({ where: { poolId: existingPool.id } });
      await prisma.poolMember.deleteMany({ where: { poolId: existingPool.id } });
      await prisma.pool.delete({ where: { id: existingPool.id } });
    }
  }

  const pool = await prisma.pool.create({
    data: {
      name: "Test Pool - Automated",
      description: "Pool para pruebas automatizadas de avance de torneo",
      tournamentInstanceId: instance.id,
      visibility: "PRIVATE",
      scoringPresetKey: "CLASSIC",
      deadlineMinutesBeforeKickoff: 10,
      timeZone: "UTC",
      createdByUserId: admin.id,
    },
  });

  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: admin.id,
      role: "HOST",
      status: "ACTIVE",
    },
  });

  console.log(`   ✅ Pool: ${pool.name}\n`);

  // 5. Simular resultados de fase de grupos
  console.log("⚽ Paso 5: Simulando resultados de fase de grupos (72 partidos)...");
  const data = instance.dataJson as any;
  const groupMatches = data.matches.filter((m: any) => m.phaseId === "group_stage");

  console.log(`   📊 Total de partidos de grupos: ${groupMatches.length}`);

  // Estrategia de resultados para crear clasificaciones claras:
  // - Posición 1 (ganador): 3 victorias = 9 puntos
  // - Posición 2 (segundo): 2 victorias, 1 empate = 7 puntos
  // - Posición 3 (tercero): 1 victoria, 1 empate, 1 derrota = 4 puntos
  // - Posición 4 (último): 3 derrotas = 0 puntos

  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  for (const group of groups) {
    const groupMatchesFiltered = groupMatches.filter((m: any) => m.groupId === group);

    // Definir resultados para que el ranking sea claro:
    // Team 1 = 1° lugar, Team 2 = 2° lugar, Team 3 = 3° lugar, Team 4 = 4° lugar
    const resultsMap: Record<string, { homeGoals: number; awayGoals: number }> = {
      // Jornada 1
      [`m_${group}_1_1`]: { homeGoals: 3, awayGoals: 0 }, // T1 vs T2 → T1 gana
      [`m_${group}_1_2`]: { homeGoals: 1, awayGoals: 1 }, // T3 vs T4 → Empate
      // Jornada 2
      [`m_${group}_2_1`]: { homeGoals: 2, awayGoals: 0 }, // T1 vs T3 → T1 gana
      [`m_${group}_2_2`]: { homeGoals: 2, awayGoals: 1 }, // T2 vs T4 → T2 gana
      // Jornada 3
      [`m_${group}_3_1`]: { homeGoals: 2, awayGoals: 0 }, // T1 vs T4 → T1 gana
      [`m_${group}_3_2`]: { homeGoals: 1, awayGoals: 1 }, // T2 vs T3 → Empate
    };

    for (const match of groupMatchesFiltered) {
      const result = resultsMap[match.id];
      if (!result) {
        console.error(`   ⚠️ No se encontró resultado predefinido para ${match.id}`);
        continue;
      }

      // Publicar resultado usando helper
      await publishMatchResult(pool.id, match.id, result.homeGoals, result.awayGoals, admin.id);
    }

    console.log(`   ✅ Grupo ${group}: 6/6 partidos con resultado`);
  }

  console.log(`   ✅ Total: 72/72 partidos de grupos completados\n`);

  // 6. Verificar que la fase de grupos está completa
  console.log("✔️  Paso 6: Verificando completitud de fase de grupos...");
  const validation = await validateGroupStageComplete(instance.id);

  if (!validation.isComplete) {
    console.error(`   ❌ ERROR: Fase de grupos incompleta!`);
    console.error(`   Faltan: ${validation.missingMatches.join(", ")}`);
    throw new Error("Fase de grupos incompleta");
  }

  console.log(`   ✅ Fase de grupos completa (${validation.missingMatches.length} faltantes)\n`);

  // 7. Avanzar a Round of 32
  console.log("🚀 Paso 7: Avanzando a Round of 32...");
  const r32Result = await advanceToRoundOf32(instance.id);

  console.log(`   ✅ Winners: ${r32Result.winners.size} equipos`);
  console.log(`   ✅ Runners-up: ${r32Result.runnersUp.size} equipos`);
  console.log(`   ✅ Best thirds: ${r32Result.bestThirds.length} equipos`);
  console.log(`   ✅ Partidos resueltos: ${r32Result.resolvedMatches.length}/16\n`);

  // Verificar que no haya placeholders en R32
  const updatedInstance1 = await prisma.tournamentInstance.findUnique({
    where: { id: instance.id },
  });
  const updatedData1 = updatedInstance1!.dataJson as any;
  const r32Matches = updatedData1.matches.filter((m: any) => m.phaseId === "round_of_32");

  const placeholdersInR32 = r32Matches.filter((m: any) =>
    m.homeTeamId.startsWith("W_") ||
    m.homeTeamId.startsWith("RU_") ||
    m.homeTeamId.startsWith("3rd_") ||
    m.awayTeamId.startsWith("W_") ||
    m.awayTeamId.startsWith("RU_") ||
    m.awayTeamId.startsWith("3rd_")
  );

  if (placeholdersInR32.length > 0) {
    console.error(`   ❌ ERROR: Aún hay ${placeholdersInR32.length} partidos con placeholders en R32!`);
    console.error(`   Partidos: ${placeholdersInR32.map((m: any) => m.id).join(", ")}`);
    throw new Error("Placeholders no resueltos en R32");
  }

  console.log(`   ✅ VERIFICACIÓN: 0 placeholders en Round of 32\n`);

  // 8. Simular resultados de R32
  console.log("⚽ Paso 8: Simulando resultados de Round of 32 (16 partidos)...");

  for (let i = 0; i < r32Matches.length; i++) {
    const match = r32Matches[i];
    // Home team gana siempre (para simplificar)
    await publishMatchResult(pool.id, match.id, 2, 1, admin.id);
  }

  console.log(`   ✅ Round of 32: 16/16 partidos completados\n`);

  // 9. Avanzar a Round of 16
  console.log("🚀 Paso 9: Avanzando a Round of 16...");
  const r16Result = await advanceKnockoutPhase(instance.id, "round_of_32", "round_of_16");

  console.log(`   ✅ Partidos resueltos: ${r16Result.resolvedMatches.length}/8\n`);

  // 10. Simular resultados de R16
  console.log("⚽ Paso 10: Simulando resultados de Round of 16 (8 partidos)...");

  const updatedInstance2 = await prisma.tournamentInstance.findUnique({
    where: { id: instance.id },
  });
  const updatedData2 = updatedInstance2!.dataJson as any;
  const r16Matches = updatedData2.matches.filter((m: any) => m.phaseId === "round_of_16");

  for (let i = 0; i < r16Matches.length; i++) {
    const match = r16Matches[i];
    await publishMatchResult(pool.id, match.id, 3, 2, admin.id);
  }

  console.log(`   ✅ Round of 16: 8/8 partidos completados\n`);

  // 11. Avanzar a Quarter-finals
  console.log("🚀 Paso 11: Avanzando a Cuartos de Final...");
  const qfResult = await advanceKnockoutPhase(instance.id, "round_of_16", "quarter_finals");

  console.log(`   ✅ Partidos resueltos: ${qfResult.resolvedMatches.length}/4\n`);

  // 12. Simular resultados de QF
  console.log("⚽ Paso 12: Simulando resultados de Cuartos de Final (4 partidos)...");

  const updatedInstance3 = await prisma.tournamentInstance.findUnique({
    where: { id: instance.id },
  });
  const updatedData3 = updatedInstance3!.dataJson as any;
  const qfMatches = updatedData3.matches.filter((m: any) => m.phaseId === "quarter_finals");

  for (let i = 0; i < qfMatches.length; i++) {
    const match = qfMatches[i];
    await publishMatchResult(pool.id, match.id, 1, 0, admin.id);
  }

  console.log(`   ✅ Cuartos de Final: 4/4 partidos completados\n`);

  // 13. Avanzar a Semi-finals
  console.log("🚀 Paso 13: Avanzando a Semifinales...");
  const sfResult = await advanceKnockoutPhase(instance.id, "quarter_finals", "semi_finals");

  console.log(`   ✅ Partidos resueltos: ${sfResult.resolvedMatches.length}/2\n`);

  // 14. Simular resultados de SF
  console.log("⚽ Paso 14: Simulando resultados de Semifinales (2 partidos)...");

  const updatedInstance4 = await prisma.tournamentInstance.findUnique({
    where: { id: instance.id },
  });
  const updatedData4 = updatedInstance4!.dataJson as any;
  const sfMatches = updatedData4.matches.filter((m: any) => m.phaseId === "semi_finals");

  for (let i = 0; i < sfMatches.length; i++) {
    const match = sfMatches[i];
    await publishMatchResult(pool.id, match.id, 2, 1, admin.id);
  }

  console.log(`   ✅ Semifinales: 2/2 partidos completados\n`);

  // 15. Avanzar a Finals
  console.log("🚀 Paso 15: Avanzando a Final...");
  const finalResult = await advanceKnockoutPhase(instance.id, "semi_finals", "finals");

  console.log(`   ✅ Partidos resueltos: ${finalResult.resolvedMatches.length}/2 (3er lugar + Final)\n`);

  // 16. Verificación final
  console.log("✔️  Paso 16: Verificación final de placeholders...");

  const finalInstance = await prisma.tournamentInstance.findUnique({
    where: { id: instance.id },
  });
  const finalData = finalInstance!.dataJson as any;

  const allMatches = finalData.matches;
  const allPlaceholders = allMatches.filter((m: any) =>
    m.homeTeamId.startsWith("W_") ||
    m.homeTeamId.startsWith("RU_") ||
    m.homeTeamId.startsWith("L_") ||
    m.homeTeamId.startsWith("3rd_") ||
    m.awayTeamId.startsWith("W_") ||
    m.awayTeamId.startsWith("RU_") ||
    m.awayTeamId.startsWith("L_") ||
    m.awayTeamId.startsWith("3rd_")
  );

  if (allPlaceholders.length > 0) {
    console.error(`   ❌ ERROR: Aún hay ${allPlaceholders.length} partidos con placeholders!`);
    console.error(`   Fases afectadas:`);
    const byPhase = allPlaceholders.reduce((acc: any, m: any) => {
      acc[m.phaseId] = (acc[m.phaseId] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byPhase).forEach(([phase, count]) => {
      console.error(`      - ${phase}: ${count} partidos`);
    });
    throw new Error("Placeholders no resueltos");
  }

  console.log(`   ✅ VERIFICACIÓN EXITOSA: 0 placeholders en todo el torneo\n`);

  // 17. Resumen final
  console.log("═══════════════════════════════════════════════════════════");
  console.log("✨ PRUEBAS COMPLETADAS EXITOSAMENTE\n");
  console.log("📊 Resumen de avances:");
  console.log(`   - Fase de Grupos → Round of 32: ✅`);
  console.log(`   - Round of 32 → Round of 16: ✅`);
  console.log(`   - Round of 16 → Cuartos de Final: ✅`);
  console.log(`   - Cuartos de Final → Semifinales: ✅`);
  console.log(`   - Semifinales → Final: ✅`);
  console.log(`\n📈 Estadísticas:`);
  console.log(`   - Total de partidos: ${allMatches.length}`);
  console.log(`   - Partidos de grupos: 72`);
  console.log(`   - Partidos eliminatorios: 32`);
  console.log(`   - Equipos clasificados: 32`);
  console.log(`   - Equipos eliminados en grupos: 16`);
  console.log(`\n🎯 Pool de prueba:`);
  console.log(`   - Nombre: ${pool.name}`);
  console.log(`   - ID: ${pool.id}`);
  console.log(`   - Instancia: ${instance.name} (${instance.id})`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("\n❌ ERROR EN PRUEBAS AUTOMATIZADAS:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
