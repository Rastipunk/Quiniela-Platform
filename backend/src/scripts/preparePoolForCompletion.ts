/**
 * Script para preparar un pool para testing de transición automática
 *
 * Deja solo 1 partido sin resultado para que puedas ver la transición
 * automática ACTIVE → COMPLETED cuando publiques el último resultado
 *
 * Uso: npm run script:prepare-completion -- <poolId>
 */

import "dotenv/config";
import { prisma } from "../db";

async function main() {
  const poolId = process.argv[2];

  if (!poolId) {
    console.error('❌ Error: Debes proporcionar un poolId');
    console.log('Uso: npm run script:prepare-completion -- <poolId>');
    process.exit(1);
  }

  console.log(`🔄 Preparando pool ${poolId} para testing de transición automática...\n`);

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

  // Crear resultados dummy para todos EXCEPTO 1 partido
  const matchIdsWithResults = new Set(existingResults.map(r => r.matchId));
  const matchesWithoutResults = allMatches.filter((m: any) => !matchIdsWithResults.has(m.id));

  if (matchesWithoutResults.length === 0) {
    console.log('\n⚠️ Todos los partidos ya tienen resultado');
    console.log('   El pool debería estar en COMPLETED automáticamente');
    process.exit(0);
  }

  // Dejar el primer partido sin resultado para testing
  const matchToLeave = matchesWithoutResults[0];
  const matchesToFill = matchesWithoutResults.slice(1);

  console.log(`\n🎲 Creando resultados dummy para ${matchesToFill.length} partidos...`);
  console.log(`   (Dejando 1 partido sin resultado para testing)`);

  const hostUserId = pool.members[0]?.userId || pool.createdByUserId;

  let count = 0;
  for (const match of matchesToFill) {
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

    count++;
    if (count % 10 === 0) {
      console.log(`   ⏳ Procesados ${count}/${matchesToFill.length}...`);
    }
  }

  console.log(`✅ Resultados dummy creados: ${matchesToFill.length}`);

  // Verificar estado final
  const finalResults = await prisma.poolMatchResult.findMany({
    where: {
      poolId,
      matchId: { in: allMatches.map((m: any) => m.id) }
    }
  });

  console.log(`\n📊 Estado final:`);
  console.log(`   Total partidos: ${allMatches.length}`);
  console.log(`   Con resultado: ${finalResults.length}`);
  console.log(`   Sin resultado: ${allMatches.length - finalResults.length}`);

  // Obtener info del partido pendiente
  const teams = (tournamentData.teams || []) as any[];
  const homeTeam = teams.find((t: any) => t.id === matchToLeave.homeTeamId);
  const awayTeam = teams.find((t: any) => t.id === matchToLeave.awayTeamId);

  console.log(`\n🎯 PARTIDO PENDIENTE PARA TESTING:`);
  console.log(`   Match ID: ${matchToLeave.id}`);
  console.log(`   Equipos: ${homeTeam?.name || matchToLeave.homeTeamId} vs ${awayTeam?.name || matchToLeave.awayTeamId}`);
  console.log(`   Fase: ${matchToLeave.phaseId || 'N/A'}`);
  console.log(`   Grupo: ${matchToLeave.groupId || 'N/A'}`);

  console.log(`\n✅ LISTO! Ahora puedes:`);
  console.log(`   1. Ir al pool como HOST`);
  console.log(`   2. Buscar el partido: "${homeTeam?.name || matchToLeave.homeTeamId} vs ${awayTeam?.name || matchToLeave.awayTeamId}"`);
  console.log(`   3. Publicar el resultado de ese partido`);
  console.log(`   4. ¡Ver la transición automática a COMPLETED! 🏆`);
  console.log(`\n💡 Tip: Usa los filtros en la pestaña Partidos para encontrarlo más rápido`);
  console.log(`   - Filtro "Solo sin resultado" te mostrará solo ese partido`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
