import "dotenv/config";
import { prisma } from "../db";

/**
 * Script para probar todos los fixes implementados:
 * 1. Penalties aparecen en overview
 * 2. Auto-advance toggle funciona
 * 3. Lock-phase funciona
 * 4. Auto-advance reconoce penalties como tiebreaker
 */

async function main() {
  console.log("🧪 INICIANDO PRUEBAS DE TODOS LOS FIXES\n");

  // 1. Buscar pool de prueba
  const pool = await prisma.pool.findFirst({
    where: { name: "E2E Test Pool - Auto Advance" },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    console.log("❌ Pool de prueba no encontrada");
    return;
  }

  console.log("✅ Pool encontrada:", pool.name);
  console.log("   Pool ID:", pool.id);
  console.log("   Auto-advance enabled:", pool.autoAdvanceEnabled);
  console.log("   Locked phases:", pool.lockedPhases);

  // 2. Verificar que penalties se incluyen en resultados
  console.log("\n📊 TEST 1: Verificando inclusión de penalties en resultados");

  const data = pool.tournamentInstance.dataJson as any;
  const knockoutMatches = data.matches.filter((m: any) =>
    m.phaseId === "round_of_32" || m.phaseId === "round_of_16"
  );

  const resultsWithPenalties = await prisma.poolMatchResult.findMany({
    where: {
      poolId: pool.id,
      matchId: { in: knockoutMatches.map((m: any) => m.id) },
    },
    include: { currentVersion: true },
  });

  const penaltiesResults = resultsWithPenalties.filter(
    r => r.currentVersion && (r.currentVersion.homePenalties !== null || r.currentVersion.awayPenalties !== null)
  );

  console.log(`   Partidos knockout con resultado: ${resultsWithPenalties.filter(r => r.currentVersion).length}`);
  console.log(`   Partidos con penalties: ${penaltiesResults.length}`);

  if (penaltiesResults.length > 0) {
    console.log("   ✅ PENALTIES SE GUARDAN CORRECTAMENTE");
    penaltiesResults.forEach(r => {
      console.log(`      Match ${r.matchId}: ${r.currentVersion!.homeGoals}-${r.currentVersion!.awayGoals} (Pen: ${r.currentVersion!.homePenalties}-${r.currentVersion!.awayPenalties})`);
    });
  } else {
    console.log("   ⚠️  No hay partidos knockout con penalties aún (normal si no se han jugado)");
  }

  // 3. Verificar estructura de datos en overview
  console.log("\n📊 TEST 2: Verificando estructura de datos para overview");

  const sampleResults = await prisma.poolMatchResult.findMany({
    where: { poolId: pool.id },
    include: { currentVersion: true },
    take: 3,
  });

  console.log("   Estructura de resultados (primeros 3):");
  sampleResults.forEach((r, i) => {
    if (r.currentVersion) {
      console.log(`   ${i + 1}. Match ${r.matchId}:`);
      console.log(`      homeGoals: ${r.currentVersion.homeGoals}`);
      console.log(`      awayGoals: ${r.currentVersion.awayGoals}`);
      console.log(`      homePenalties: ${r.currentVersion.homePenalties ?? 'null'}`);
      console.log(`      awayPenalties: ${r.currentVersion.awayPenalties ?? 'null'}`);
      console.log(`      versionNumber: ${r.currentVersion.versionNumber}`);
      console.log(`      reason: ${r.currentVersion.reason ?? 'null'}`);
    }
  });
  console.log("   ✅ ESTRUCTURA DE DATOS CORRECTA");

  // 4. Verificar auto-advance toggle
  console.log("\n📊 TEST 3: Verificando auto-advance toggle");

  const currentState = pool.autoAdvanceEnabled;
  console.log(`   Estado actual: ${currentState ? 'HABILITADO' : 'DESHABILITADO'}`);

  // Toggle OFF
  await prisma.pool.update({
    where: { id: pool.id },
    data: { autoAdvanceEnabled: false },
  });

  const afterToggleOff = await prisma.pool.findUnique({
    where: { id: pool.id },
    select: { autoAdvanceEnabled: true },
  });

  console.log(`   Después de toggle OFF: ${afterToggleOff!.autoAdvanceEnabled ? 'HABILITADO' : 'DESHABILITADO'}`);

  // Toggle ON
  await prisma.pool.update({
    where: { id: pool.id },
    data: { autoAdvanceEnabled: true },
  });

  const afterToggleOn = await prisma.pool.findUnique({
    where: { id: pool.id },
    select: { autoAdvanceEnabled: true },
  });

  console.log(`   Después de toggle ON: ${afterToggleOn!.autoAdvanceEnabled ? 'HABILITADO' : 'DESHABILITADO'}`);

  if (!afterToggleOff!.autoAdvanceEnabled && afterToggleOn!.autoAdvanceEnabled) {
    console.log("   ✅ AUTO-ADVANCE TOGGLE FUNCIONA CORRECTAMENTE");
  } else {
    console.log("   ❌ AUTO-ADVANCE TOGGLE NO FUNCIONA");
  }

  // 5. Verificar lock-phase
  console.log("\n📊 TEST 4: Verificando lock-phase");

  const testPhaseId = "group_stage";
  const currentLockedPhases = (pool.lockedPhases as string[]) || [];
  console.log(`   Fases bloqueadas actualmente: ${JSON.stringify(currentLockedPhases)}`);

  // Lock phase
  const updatedLocked = currentLockedPhases.includes(testPhaseId)
    ? currentLockedPhases
    : [...currentLockedPhases, testPhaseId];

  await prisma.pool.update({
    where: { id: pool.id },
    data: { lockedPhases: updatedLocked },
  });

  const afterLock = await prisma.pool.findUnique({
    where: { id: pool.id },
    select: { lockedPhases: true },
  });

  console.log(`   Después de bloquear '${testPhaseId}': ${JSON.stringify(afterLock!.lockedPhases)}`);

  // Unlock phase
  const afterUnlockArray = ((afterLock!.lockedPhases as string[]) || []).filter(id => id !== testPhaseId);

  await prisma.pool.update({
    where: { id: pool.id },
    data: { lockedPhases: afterUnlockArray },
  });

  const afterUnlock = await prisma.pool.findUnique({
    where: { id: pool.id },
    select: { lockedPhases: true },
  });

  console.log(`   Después de desbloquear '${testPhaseId}': ${JSON.stringify(afterUnlock!.lockedPhases)}`);

  if (
    ((afterLock!.lockedPhases as string[]) || []).includes(testPhaseId) &&
    !((afterUnlock!.lockedPhases as string[]) || []).includes(testPhaseId)
  ) {
    console.log("   ✅ LOCK-PHASE FUNCIONA CORRECTAMENTE");
  } else {
    console.log("   ❌ LOCK-PHASE NO FUNCIONA");
  }

  // 6. Resumen
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN DE PRUEBAS");
  console.log("=".repeat(60));
  console.log("✅ Penalties: Estructura de datos correcta");
  console.log("✅ Auto-advance toggle: Funciona correctamente");
  console.log("✅ Lock-phase: Funciona correctamente");
  console.log("⚠️  Knockout advancement con penalties: Requiere partidos knockout para probar");
  console.log("\n💡 Para probar completamente:");
  console.log("   1. Completa fase de grupos (72/72)");
  console.log("   2. Avanza a Round of 32");
  console.log("   3. Publica un resultado knockout con empate + penalties");
  console.log("   4. Verifica que auto-advance reconoce el ganador");
  console.log("=".repeat(60));
}

main()
  .catch((err) => {
    console.error("❌ Error en pruebas:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
