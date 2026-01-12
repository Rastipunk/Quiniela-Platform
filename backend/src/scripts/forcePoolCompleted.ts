/**
 * Script para forzar un pool a estado COMPLETED
 *
 * Uso: npm run script:force-completed -- <poolId>
 *
 * Este script simula que todos los partidos tienen resultado
 * para testear la transición ACTIVE → COMPLETED
 */

import "dotenv/config";
import { prisma } from "../db";
import { transitionToCompleted } from "../services/poolStateMachine";

async function main() {
  const poolId = process.argv[2];

  if (!poolId) {
    console.error('❌ Error: Debes proporcionar un poolId');
    console.log('Uso: npm run script:force-completed -- <poolId>');
    process.exit(1);
  }

  console.log(`🔄 Forzando pool ${poolId} a estado COMPLETED...\n`);

  // Verificar que el pool existe
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      tournamentInstance: true,
      members: { where: { role: "HOST" } }
    }
  });

  if (!pool) {
    console.error(`❌ Pool ${poolId} no encontrado`);
    process.exit(1);
  }

  console.log(`📊 Pool encontrado: ${pool.name}`);
  console.log(`   Estado actual: ${pool.status}`);

  if (pool.status === "COMPLETED") {
    console.log('✅ El pool ya está en estado COMPLETED');
    process.exit(0);
  }

  if (pool.status !== "ACTIVE") {
    console.error(`❌ El pool debe estar en estado ACTIVE (actual: ${pool.status})`);
    process.exit(1);
  }

  // Obtener todos los partidos del torneo
  const tournamentData = pool.tournamentInstance.dataJson as any;
  const allMatches = tournamentData.matches || [];

  console.log(`\n📋 Partidos en el torneo: ${allMatches.length}`);

  // Verificar cuántos partidos tienen resultado
  const existingResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m: any) => m.id) }
    }
  });

  console.log(`   Partidos con resultado: ${existingResults.length}`);
  console.log(`   Partidos sin resultado: ${allMatches.length - existingResults.length}`);

  // Crear resultados dummy para los partidos faltantes
  const matchIdsWithResults = new Set(existingResults.map(r => r.matchId));
  const matchesWithoutResults = allMatches.filter((m: any) => !matchIdsWithResults.has(m.id));

  console.log(`\n🎲 Creando resultados dummy para ${matchesWithoutResults.length} partidos...`);

  const hostUserId = pool.members[0]?.userId || pool.createdByUserId;

  for (const match of matchesWithoutResults) {
    // Crear resultado dummy (1-0)
    await prisma.$transaction(async (tx) => {
      const header = await tx.poolMatchResult.create({
        data: {
          poolId,
          matchId: match.id
        }
      });

      const version = await tx.poolMatchResultVersion.create({
        data: {
          resultId: header.id,
          versionNumber: 1,
          status: "PUBLISHED",
          homeGoals: 1,
          awayGoals: 0,
          createdByUserId: hostUserId
        }
      });

      await tx.poolMatchResult.update({
        where: { id: header.id },
        data: { currentVersionId: version.id }
      });
    });
  }

  console.log(`✅ Resultados dummy creados`);

  // Verificar que ahora todos tienen resultado
  const finalResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m: any) => m.id) }
    }
  });

  console.log(`\n📊 Verificación final:`);
  console.log(`   Total partidos: ${allMatches.length}`);
  console.log(`   Con resultado: ${finalResults.length}`);

  if (finalResults.length !== allMatches.length) {
    console.error('❌ Error: No todos los partidos tienen resultado');
    process.exit(1);
  }

  // Ahora intentar la transición
  console.log(`\n⚡ Intentando transición a COMPLETED...`);

  try {
    await transitionToCompleted(poolId, hostUserId);
    console.log(`✅ Pool transicionado a COMPLETED exitosamente`);

    // Verificar el nuevo estado
    const updatedPool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { status: true, name: true }
    });

    console.log(`\n🎉 Estado final: ${updatedPool?.status}`);
    console.log(`\n✅ LISTO! Ahora puedes:`);
    console.log(`   1. Recargar el pool en el frontend (F5)`);
    console.log(`   2. Verificar el badge "🏆 Finalizada"`);
    console.log(`   3. Ir a la pestaña Admin y ver el botón "📦 Archivar Pool"`);

  } catch (error: any) {
    console.error(`❌ Error al transicionar: ${error.message}`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
