/**
 * TEST AUTOMATIZADO DE SCORING
 * ============================
 *
 * Este script valida el sistema de scoring con casos de prueba
 * donde los resultados esperados fueron calculados MANUALMENTE.
 *
 * Cada test case tiene:
 * - Descripción clara del escenario
 * - Pick del usuario
 * - Resultado oficial
 * - Puntos ESPERADOS (calculados a mano)
 * - Puntos CALCULADOS (por el sistema)
 * - PASS/FAIL
 *
 * Ejecutar: npx ts-node-dev --transpile-only src/scripts/testScoring.ts
 */

import { scoreMatchPick, applyAutoScalingToConfig } from "../lib/scoringAdvanced";
import { scoreGroupStandings, scoreKnockoutWinner, scoreStructuralPhase } from "../services/structuralScoring";
import type { PhasePickConfig } from "../types/pickConfig";

// ==================== CONFIGURACIÓN DE TESTS ====================

type TestResult = {
  name: string;
  description: string;
  expected: number;
  actual: number;
  passed: boolean;
  details?: string;
};

const results: TestResult[] = [];

function test(name: string, description: string, expected: number, actual: number, details?: string) {
  const passed = expected === actual;
  results.push({ name, description, expected, actual, passed, details });

  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  console.log(`   ${description}`);
  console.log(`   Esperado: ${expected} pts | Calculado: ${actual} pts`);
  if (!passed) {
    console.log(`   ⚠️  DIFERENCIA: ${actual - expected} pts`);
  }
  if (details) {
    console.log(`   📝 ${details}`);
  }
  console.log();
}

// ==================== CONFIGURACIONES DE FASE PARA TESTS ====================

// Config BASIC: Solo EXACT_SCORE habilitado (20 pts)
const configBasic: PhasePickConfig = {
  phaseId: "group_stage",
  requiresScore: true,
  matchPicks: {
    types: [
      { key: "EXACT_SCORE", enabled: true, points: 20 },
      { key: "GOAL_DIFFERENCE", enabled: false, points: 0 },
      { key: "PARTIAL_SCORE", enabled: false, points: 0 },
      { key: "TOTAL_GOALS", enabled: false, points: 0 },
      { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
    ],
  },
};

// Config ADVANCED Grupos: 4 tipos habilitados
const configAdvancedGroups: PhasePickConfig = {
  phaseId: "group_stage",
  requiresScore: true,
  matchPicks: {
    types: [
      { key: "EXACT_SCORE", enabled: true, points: 20 },
      { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
      { key: "PARTIAL_SCORE", enabled: true, points: 8 },
      { key: "TOTAL_GOALS", enabled: true, points: 5 },
      { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
    ],
  },
};

// Config ADVANCED Eliminatorias: 2 tipos habilitados
const configAdvancedKnockout: PhasePickConfig = {
  phaseId: "round_of_16",
  requiresScore: true,
  matchPicks: {
    types: [
      { key: "EXACT_SCORE", enabled: true, points: 40 },
      { key: "GOAL_DIFFERENCE", enabled: true, points: 20 },
      { key: "PARTIAL_SCORE", enabled: false, points: 0 },
      { key: "TOTAL_GOALS", enabled: false, points: 0 },
      { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
    ],
  },
};

// ==================== TESTS DE MATCH SCORING ====================

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 1: EXACT_SCORE (Marcador Exacto)");
console.log("═".repeat(60));
console.log();

// Test 1.1: Acierto exacto
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configBasic);

  test(
    "Test 1.1: Acierto exacto (BASIC)",
    "Pick: 2-1, Resultado: 2-1",
    20, // Manual: 20 pts por exacto
    scoring.totalPoints,
    "Con preset BASIC, solo cuenta el marcador exacto"
  );
}

// Test 1.2: Fallo exacto
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 3, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configBasic);

  test(
    "Test 1.2: Fallo exacto (BASIC)",
    "Pick: 2-1, Resultado: 3-1",
    0, // Manual: 0 pts porque no acertó exacto y no hay otros tipos
    scoring.totalPoints,
    "Sin otros tipos habilitados, no hay puntos parciales"
  );
}

// Test 1.3: Empate exacto
{
  const pick = { homeGoals: 0, awayGoals: 0 };
  const result = { homeGoals: 0, awayGoals: 0 };
  const scoring = scoreMatchPick(pick, result, configBasic);

  test(
    "Test 1.3: Empate exacto 0-0",
    "Pick: 0-0, Resultado: 0-0",
    20,
    scoring.totalPoints,
    "El 0-0 cuenta como acierto exacto"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 2: GOAL_DIFFERENCE (Diferencia de Goles)");
console.log("═".repeat(60));
console.log();

// Test 2.1: Diferencia correcta, marcador incorrecto
{
  const pick = { homeGoals: 2, awayGoals: 0 }; // diff = +2
  const result = { homeGoals: 3, awayGoals: 1 }; // diff = +2
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  test(
    "Test 2.1: Diferencia correcta (+2)",
    "Pick: 2-0 (diff +2), Resultado: 3-1 (diff +2)",
    10, // Manual: 10 pts por diferencia
    scoring.totalPoints,
    "No acertó exacto (0), acertó diferencia (10)"
  );
}

// Test 2.2: Diferencia incorrecta
{
  const pick = { homeGoals: 2, awayGoals: 0 }; // diff = +2
  const result = { homeGoals: 2, awayGoals: 1 }; // diff = +1
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual: No acertó exacto, no acertó diferencia, pero:
  // - PARTIAL_SCORE: acertó local (2), no visitante (0≠1) → XOR true → 8 pts
  // - TOTAL_GOALS: pick=2, result=3 → NO
  test(
    "Test 2.2: Diferencia incorrecta, parcial correcto",
    "Pick: 2-0, Resultado: 2-1",
    8, // Manual: 8 pts por parcial (acertó los 2 del local)
    scoring.totalPoints,
    "Acertó goles del local pero no diferencia ni total"
  );
}

// Test 2.3: Empate diferencia cero
{
  const pick = { homeGoals: 1, awayGoals: 1 }; // diff = 0
  const result = { homeGoals: 2, awayGoals: 2 }; // diff = 0
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual: No exacto, pero diferencia = 0 = 0 → 10 pts
  // Parcial: 1≠2, 1≠2 → ambos fallan → 0 pts
  // Total: 2≠4 → 0 pts
  test(
    "Test 2.3: Empate diferente (diff 0)",
    "Pick: 1-1, Resultado: 2-2",
    10,
    scoring.totalPoints,
    "Ambos empates tienen diferencia 0"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 3: PARTIAL_SCORE (Marcador Parcial)");
console.log("═".repeat(60));
console.log();

// Test 3.1: Acertó solo local
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 3 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: 2-1 ≠ 2-3 → 0
  // - DIFF: +1 ≠ -1 → 0
  // - PARTIAL: home=2=2 (true), away=1≠3 (false) → XOR → 8 pts
  // - TOTAL: 3 ≠ 5 → 0
  test(
    "Test 3.1: Acertó solo goles local",
    "Pick: 2-1, Resultado: 2-3",
    8,
    scoring.totalPoints,
    "Acertó los 2 del local, falló visitante"
  );
}

// Test 3.2: Acertó solo visitante
{
  const pick = { homeGoals: 1, awayGoals: 2 };
  const result = { homeGoals: 3, awayGoals: 2 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: -1 ≠ +1 → 0
  // - PARTIAL: home=1≠3 (false), away=2=2 (true) → XOR → 8 pts
  // - TOTAL: 3 ≠ 5 → 0
  test(
    "Test 3.2: Acertó solo goles visitante",
    "Pick: 1-2, Resultado: 3-2",
    8,
    scoring.totalPoints,
    "Acertó los 2 del visitante, falló local"
  );
}

// Test 3.3: Acertó ambos (es EXACT, no PARTIAL)
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual: EXACT_SCORE acierta → 20 pts y TERMINA (no suma parcial)
  test(
    "Test 3.3: Acertó ambos = EXACT (no PARTIAL)",
    "Pick: 2-1, Resultado: 2-1",
    20,
    scoring.totalPoints,
    "Si acierta exacto, termina y no suma otros tipos"
  );
}

// Test 3.4: No acertó ninguno
{
  const pick = { homeGoals: 1, awayGoals: 0 };
  const result = { homeGoals: 3, awayGoals: 2 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: +1 = +1 → ¡SÍ! 10 pts
  // - PARTIAL: 1≠3, 0≠2 → ambos false → XOR false → 0
  // - TOTAL: 1 ≠ 5 → 0
  test(
    "Test 3.4: Diferencia coincide por casualidad",
    "Pick: 1-0 (diff +1), Resultado: 3-2 (diff +1)",
    10,
    scoring.totalPoints,
    "La diferencia coincide aunque los números son muy distintos"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 4: TOTAL_GOALS (Total de Goles)");
console.log("═".repeat(60));
console.log();

// Test 4.1: Total correcto, todo lo demás mal
{
  const pick = { homeGoals: 2, awayGoals: 1 }; // total = 3
  const result = { homeGoals: 0, awayGoals: 3 }; // total = 3
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: +1 ≠ -3 → 0
  // - PARTIAL: 2≠0, 1≠3 → ambos false → 0
  // - TOTAL: 3 = 3 → 5 pts
  test(
    "Test 4.1: Solo total correcto",
    "Pick: 2-1 (3 goles), Resultado: 0-3 (3 goles)",
    5,
    scoring.totalPoints,
    "Solo coincide el total de goles"
  );
}

// Test 4.2: Total incorrecto
{
  const pick = { homeGoals: 2, awayGoals: 1 }; // total = 3
  const result = { homeGoals: 2, awayGoals: 2 }; // total = 4
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: +1 ≠ 0 → 0
  // - PARTIAL: 2=2 (true), 1≠2 (false) → XOR → 8 pts
  // - TOTAL: 3 ≠ 4 → 0
  test(
    "Test 4.2: Total incorrecto, parcial sí",
    "Pick: 2-1 (3 goles), Resultado: 2-2 (4 goles)",
    8,
    scoring.totalPoints,
    "El parcial (local) sí acierta"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 5: ACUMULACIÓN DE PUNTOS");
console.log("═".repeat(60));
console.log();

// Test 5.1: Múltiples aciertos (no exacto)
{
  const pick = { homeGoals: 3, awayGoals: 1 }; // diff=+2, total=4
  const result = { homeGoals: 4, awayGoals: 2 }; // diff=+2, total=6
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: +2 = +2 → 10 pts
  // - PARTIAL: 3≠4, 1≠2 → ambos false → 0
  // - TOTAL: 4 ≠ 6 → 0
  // Total = 10 pts
  test(
    "Test 5.1: Solo diferencia acierta",
    "Pick: 3-1 (diff +2), Resultado: 4-2 (diff +2)",
    10,
    scoring.totalPoints,
    "Diferencia coincide pero total no"
  );
}

// Test 5.2: Diff + Parcial + Total (teóricamente posible)
{
  // Buscar un caso donde diff, parcial Y total coincidan pero no exacto
  // Pick: 2-0 (diff=+2, total=2)
  // Result: 3-1 (diff=+2, total=4) → diff sí, total no
  // Necesitamos: diff igual, un parcial, y total igual
  // Pick: 2-1 (diff=+1, total=3)
  // Result: 3-2 (diff=+1, total=5) → diff sí, total no
  // Es difícil encontrar un caso donde todo coincida menos exacto

  // Caso: Pick 2-1, Result 2-2
  // diff: +1 vs 0 → NO
  // parcial: 2=2 (sí), 1≠2 → XOR → SÍ (8)
  // total: 3 vs 4 → NO
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 2 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  test(
    "Test 5.2: Solo parcial acierta",
    "Pick: 2-1, Resultado: 2-2",
    8,
    scoring.totalPoints,
    "Solo el marcador parcial (local) coincide"
  );
}

// Test 5.3: Caso donde diff + parcial coinciden
{
  // Pick: 2-1 (diff=+1)
  // Result: 3-2 (diff=+1) → diff SÍ
  // Parcial: 2≠3, 1≠2 → NO
  // Total: 3≠5 → NO
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 3, awayGoals: 2 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  test(
    "Test 5.3: Diferencia coincide",
    "Pick: 2-1 (diff +1), Resultado: 3-2 (diff +1)",
    10,
    scoring.totalPoints,
    "Mismo resultado del equipo pero con más goles"
  );
}

// Test 5.4: Caso extremo - 0-0 predicho, goleada real
{
  const pick = { homeGoals: 0, awayGoals: 0 };
  const result = { homeGoals: 5, awayGoals: 0 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Manual:
  // - EXACT: NO
  // - DIFF: 0 ≠ +5 → NO
  // - PARTIAL: 0≠5, 0=0 → XOR true → 8 pts
  // - TOTAL: 0 ≠ 5 → NO
  test(
    "Test 5.4: 0-0 vs goleada",
    "Pick: 0-0, Resultado: 5-0",
    8,
    scoring.totalPoints,
    "Acertó que el visitante no metería goles"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 6: GROUP_STANDINGS (Posiciones de Grupo)");
console.log("═".repeat(60));
console.log();

// Configuración de GROUP_STANDINGS
const groupStandingsConfig = {
  pointsPosition1: 15,
  pointsPosition2: 12,
  pointsPosition3: 10,
  pointsPosition4: 8,
  bonusPerfectGroupEnabled: true,
  bonusPerfectGroup: 20,
};

// Test 6.1: Grupo perfecto
{
  const pick = { teamIds: ["MEX", "USA", "CAN", "JAM"] };
  const result = { teamIds: ["MEX", "USA", "CAN", "JAM"] };
  const points = scoreGroupStandings(pick, result, groupStandingsConfig);

  // Manual: 15 + 12 + 10 + 8 + 20 (bonus) = 65 pts
  test(
    "Test 6.1: Grupo perfecto (4/4 + bonus)",
    "Pick: MEX-USA-CAN-JAM, Resultado: MEX-USA-CAN-JAM",
    65,
    points,
    "15+12+10+8 = 45 posiciones + 20 bonus = 65"
  );
}

// Test 6.2: 3 de 4 posiciones correctas
{
  const pick = { teamIds: ["MEX", "USA", "CAN", "JAM"] };
  const result = { teamIds: ["MEX", "USA", "JAM", "CAN"] }; // 3° y 4° invertidos
  const points = scoreGroupStandings(pick, result, groupStandingsConfig);

  // Manual: 15 (1°) + 12 (2°) + 0 (3°) + 0 (4°) = 27 pts (sin bonus)
  test(
    "Test 6.2: 2 posiciones correctas (1° y 2°)",
    "Pick: MEX-USA-CAN-JAM, Resultado: MEX-USA-JAM-CAN",
    27,
    points,
    "15+12 = 27, sin bonus porque no es perfecto"
  );
}

// Test 6.3: Solo 1° correcto
{
  const pick = { teamIds: ["MEX", "USA", "CAN", "JAM"] };
  const result = { teamIds: ["MEX", "JAM", "USA", "CAN"] };
  const points = scoreGroupStandings(pick, result, groupStandingsConfig);

  // Manual: 15 (1°) + 0 + 0 + 0 = 15 pts
  test(
    "Test 6.3: Solo 1° correcto",
    "Pick: MEX-USA-CAN-JAM, Resultado: MEX-JAM-USA-CAN",
    15,
    points,
    "Solo el campeón del grupo coincide"
  );
}

// Test 6.4: Ninguno correcto
{
  const pick = { teamIds: ["MEX", "USA", "CAN", "JAM"] };
  const result = { teamIds: ["JAM", "CAN", "USA", "MEX"] }; // Todo al revés
  const points = scoreGroupStandings(pick, result, groupStandingsConfig);

  test(
    "Test 6.4: Ninguna posición correcta",
    "Pick: MEX-USA-CAN-JAM, Resultado: JAM-CAN-USA-MEX",
    0,
    points,
    "Orden completamente invertido"
  );
}

// Test 6.5: Config legacy (pointsPerExactPosition)
{
  const legacyConfig = {
    pointsPerExactPosition: 10,
    bonusPerfectGroup: 25,
  };
  const pick = { teamIds: ["A", "B", "C", "D"] };
  const result = { teamIds: ["A", "B", "C", "D"] };
  const points = scoreGroupStandings(pick, result, legacyConfig);

  // Manual: 10*4 + 25 = 65 pts
  test(
    "Test 6.5: Config legacy (10 pts cada posición)",
    "Pick: A-B-C-D, Resultado: A-B-C-D (perfecto)",
    65,
    points,
    "10+10+10+10 + 25 bonus = 65"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 7: KNOCKOUT_WINNER (Ganador de Eliminatoria)");
console.log("═".repeat(60));
console.log();

// Test 7.1: Acierto ganador
{
  const pick = { winnerId: "ARG" };
  const result = { winnerId: "ARG" };
  const config = { pointsPerCorrectAdvance: 25 };
  const points = scoreKnockoutWinner(pick, result, config);

  test(
    "Test 7.1: Acertó ganador",
    "Pick: Argentina avanza, Resultado: Argentina avanzó",
    25,
    points,
    "25 pts por acertar quién avanza"
  );
}

// Test 7.2: Falló ganador
{
  const pick = { winnerId: "ARG" };
  const result = { winnerId: "FRA" };
  const config = { pointsPerCorrectAdvance: 25 };
  const points = scoreKnockoutWinner(pick, result, config);

  test(
    "Test 7.2: Falló ganador",
    "Pick: Argentina avanza, Resultado: Francia avanzó",
    0,
    points,
    "0 pts por fallar"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 8: STRUCTURAL PHASE (Fase Completa)");
console.log("═".repeat(60));
console.log();

// Test 8.1: Fase de grupos completa (12 grupos)
{
  const phaseConfig = {
    structuralPicks: {
      type: "GROUP_STANDINGS",
      config: {
        pointsPosition1: 10,
        pointsPosition2: 10,
        pointsPosition3: 10,
        pointsPosition4: 10,
        bonusPerfectGroupEnabled: true,
        bonusPerfectGroup: 15,
      },
    },
  };

  // Simular 3 grupos: 1 perfecto, 1 con 2 aciertos, 1 con 0 aciertos
  const pickData = {
    groups: [
      { groupId: "A", teamIds: ["A1", "A2", "A3", "A4"] }, // Perfecto
      { groupId: "B", teamIds: ["B1", "B2", "B3", "B4"] }, // 2 aciertos (1° y 2°)
      { groupId: "C", teamIds: ["C1", "C2", "C3", "C4"] }, // 0 aciertos
    ],
  };

  const resultData = {
    groups: [
      { groupId: "A", teamIds: ["A1", "A2", "A3", "A4"] }, // = pick (perfecto)
      { groupId: "B", teamIds: ["B1", "B2", "B4", "B3"] }, // 3° y 4° invertidos
      { groupId: "C", teamIds: ["C4", "C3", "C2", "C1"] }, // Todo invertido
    ],
  };

  const points = scoreStructuralPhase(pickData, resultData, phaseConfig);

  // Manual:
  // Grupo A: 10+10+10+10 + 15 bonus = 55 pts
  // Grupo B: 10+10+0+0 = 20 pts (sin bonus)
  // Grupo C: 0 pts
  // Total: 55 + 20 + 0 = 75 pts
  test(
    "Test 8.1: Fase de grupos (3 grupos)",
    "1 grupo perfecto, 1 grupo parcial, 1 grupo fallado",
    75,
    points,
    "Grupo A=55, Grupo B=20, Grupo C=0"
  );
}

// Test 8.2: Fase knockout completa
{
  const phaseConfig = {
    structuralPicks: {
      type: "KNOCKOUT_WINNER",
      config: {
        pointsPerCorrectAdvance: 30,
      },
    },
  };

  // Simular 4 partidos de octavos
  const pickData = {
    matches: [
      { matchId: "R16_1", winnerId: "ARG" },
      { matchId: "R16_2", winnerId: "BRA" },
      { matchId: "R16_3", winnerId: "GER" },
      { matchId: "R16_4", winnerId: "FRA" },
    ],
  };

  const resultData = {
    matches: [
      { matchId: "R16_1", winnerId: "ARG" }, // ✅
      { matchId: "R16_2", winnerId: "URU" }, // ❌
      { matchId: "R16_3", winnerId: "GER" }, // ✅
      { matchId: "R16_4", winnerId: "ESP" }, // ❌
    ],
  };

  const points = scoreStructuralPhase(pickData, resultData, phaseConfig);

  // Manual: 2 aciertos * 30 = 60 pts
  test(
    "Test 8.2: Fase knockout (4 partidos)",
    "2 de 4 ganadores correctos",
    60,
    points,
    "30*2 = 60 pts"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 9: REGLA DE ACUMULACIÓN");
console.log("═".repeat(60));
console.log();

/*
 * IMPORTANTE: Verificar el comportamiento de acumulación
 *
 * Comportamiento ACTUAL del código:
 * - Si acierta EXACT_SCORE → SOLO gana esos puntos (TERMINA)
 * - Si NO acierta exacto → ACUMULA todos los tipos que acierta
 */

// Test 9.1: EXACT termina (no acumula otros)
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Si fuera acumulativo sería: 20 + 10 + 5 = 35 (diff +1=+1, total 3=3)
  // Pero el código actual TERMINA al acertar exacto
  test(
    "Test 9.1: EXACT termina (no acumula)",
    "Pick: 2-1, Resultado: 2-1 (podría acumular diff+total)",
    20, // SOLO exacto
    scoring.totalPoints,
    "EXACT_SCORE termina la evaluación inmediatamente"
  );
}

// Test 9.2: Sin exacto, ¿acumula diff + total?
{
  // Buscar caso donde diff y total coincidan pero no exacto
  // Pick: 2-0 (diff=+2, total=2)
  // Result: 4-2 (diff=+2, total=6) → diff SÍ, total NO

  // Pick: 3-0 (diff=+3, total=3)
  // Result: 5-2 (diff=+3, total=7) → diff SÍ, total NO

  // Pick: 1-1 (diff=0, total=2)
  // Result: 2-2 (diff=0, total=4) → diff SÍ, total NO

  // Parece difícil encontrar un caso donde diff Y total coincidan sin exacto
  // Probemos: ¿diff + partial?

  // Pick: 2-0 (diff=+2)
  // Result: 2-1 (diff=+1) → diff NO
  // Partial: 2=2, 0≠1 → SÍ (8)

  // Para acumular necesitamos que NO sea exacto pero múltiples coincidan
  // Por diseño, si diff coincide es raro que partial también lo haga

  const pick = { homeGoals: 2, awayGoals: 0 };
  const result = { homeGoals: 3, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // EXACT: NO
  // DIFF: +2 = +2 → SÍ (10)
  // PARTIAL: 2≠3, 0≠1 → NO
  // TOTAL: 2 ≠ 4 → NO
  test(
    "Test 9.2: Solo diff acierta",
    "Pick: 2-0, Resultado: 3-1 (solo diff +2)",
    10,
    scoring.totalPoints,
    "Solo GOAL_DIFFERENCE coincide"
  );
}

// Test 9.3: ¿Puede partial + total acumular?
{
  // Necesitamos: uno de los goles coincide Y el total coincide
  // Pick: 1-2 (total=3)
  // Result: 0-3 (total=3)
  // Partial: 1≠0, 2≠3 → NO
  // Total: 3=3 → SÍ (5)

  // Pick: 2-1 (total=3)
  // Result: 0-3 (total=3)
  // Partial: 2≠0, 1≠3 → NO
  // Total: 3=3 → SÍ (5)

  // Es muy difícil que partial Y total coincidan sin exacto porque:
  // - Partial requiere que UNO coincida exactamente
  // - Total requiere que la suma coincida

  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 0, awayGoals: 3 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // EXACT: NO
  // DIFF: +1 ≠ -3 → NO
  // PARTIAL: 2≠0, 1≠3 → NO
  // TOTAL: 3=3 → SÍ (5)
  test(
    "Test 9.3: Solo total acierta",
    "Pick: 2-1, Resultado: 0-3 (total=3)",
    5,
    scoring.totalPoints,
    "Solo TOTAL_GOALS coincide"
  );
}

// Test 9.4: Caso donde diff + partial acumulan (si es posible)
{
  // Para que diff + partial acumulen:
  // - diff: homeA - awayA = homeB - awayB
  // - partial: homeA = homeB XOR awayA = awayB (pero no ambos)

  // Pick: 3-1 (diff=+2)
  // Result: 5-3 (diff=+2)
  // Diff: +2 = +2 → SÍ (10)
  // Partial: 3≠5, 1≠3 → NO

  // Pick: 3-1 (diff=+2)
  // Result: 3-1 → EXACTO!

  // Pick: 3-2 (diff=+1)
  // Result: 4-3 (diff=+1)
  // Diff: +1=+1 → SÍ (10)
  // Partial: 3≠4, 2≠3 → NO

  // Pick: 2-1 (diff=+1)
  // Result: 2-1 → EXACTO!

  // Pick: 2-1 (diff=+1)
  // Result: 3-2 (diff=+1)
  // Diff: +1=+1 → SÍ (10)
  // Partial: 2≠3, 1≠2 → NO

  // Conclusión: Por diseño matemático, es MUY DIFÍCIL
  // que múltiples tipos acumulen sin ser exacto.

  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 3, awayGoals: 2 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  test(
    "Test 9.4: Diff acierta (intento de acumular)",
    "Pick: 2-1, Resultado: 3-2 (diff +1)",
    10,
    scoring.totalPoints,
    "Solo diff coincide, partial no"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 10: AUTO-SCALING MULTIPLIERS");
console.log("═".repeat(60));
console.log();

/*
 * AUTO-SCALING: Multiplica los puntos por fase
 * Se configura con autoScaling.enabled y autoScaling.multipliers
 * El multiplicador se aplica según el phaseId
 */

// Configuración de auto-scaling para tests
const autoScalingConfig = {
  enabled: true,
  multipliers: {
    group_stage: 1.0,
    round_of_32: 1.25,
    round_of_16: 1.5,
    quarter_finals: 2.0,
    semi_finals: 2.5,
    finals: 3.0,
  } as Record<string, number>,
};

// Test 10.1: Config grupos (sin multiplicador adicional)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "group_stage",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "group_stage");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // group_stage → multiplier=1.0 → 20*1.0 = 20
  test(
    "Test 10.1: Auto-scaling grupos (x1.0)",
    "EXACT_SCORE base 20 pts, multiplicador x1.0",
    20,
    exactPoints,
    "Fase de grupos no tiene multiplicador adicional"
  );
}

// Test 10.2: Config R32 (x1.25)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "round_of_32",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "round_of_32");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // round_of_32 → multiplier=1.25 → 20*1.25 = 25
  test(
    "Test 10.2: Auto-scaling R32 (x1.25)",
    "EXACT_SCORE base 20 pts, multiplicador x1.25",
    25,
    exactPoints,
    "Dieciseisavos de final multiplica x1.25"
  );
}

// Test 10.3: Config R16 (x1.5)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "round_of_16",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "round_of_16");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // round_of_16 → multiplier=1.5 → 20*1.5 = 30
  test(
    "Test 10.3: Auto-scaling R16 (x1.5)",
    "EXACT_SCORE base 20 pts, multiplicador x1.5",
    30,
    exactPoints,
    "Octavos de final multiplica x1.5"
  );
}

// Test 10.4: Config Cuartos (x2.0)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "quarter_finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "quarter_finals");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // quarter_finals → multiplier=2.0 → 20*2.0 = 40
  test(
    "Test 10.4: Auto-scaling Cuartos (x2.0)",
    "EXACT_SCORE base 20 pts, multiplicador x2.0",
    40,
    exactPoints,
    "Cuartos de final multiplica x2.0"
  );
}

// Test 10.5: Config Semis (x2.5)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "semi_finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "semi_finals");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // semi_finals → multiplier=2.5 → 20*2.5 = 50
  test(
    "Test 10.5: Auto-scaling Semis (x2.5)",
    "EXACT_SCORE base 20 pts, multiplicador x2.5",
    50,
    exactPoints,
    "Semifinales multiplica x2.5"
  );
}

// Test 10.6: Config Final (x3.0)
{
  const baseConfig: PhasePickConfig = {
    phaseId: "finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "finals");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // finals → multiplier=3.0 → 20*3.0 = 60
  test(
    "Test 10.6: Auto-scaling Final (x3.0)",
    "EXACT_SCORE base 20 pts, multiplicador x3.0",
    60,
    exactPoints,
    "Final multiplica x3.0"
  );
}

// Test 10.7: Auto-scaling deshabilitado
{
  const baseConfig: PhasePickConfig = {
    phaseId: "finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: { enabled: false, multipliers: {} }, // disabled!
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "finals");
  const exactPoints = scaled.matchPicks?.types.find(t => t.key === "EXACT_SCORE")?.points ?? 0;

  // autoScaling.enabled=false → no multiplier → 20
  test(
    "Test 10.7: Auto-scaling deshabilitado",
    "EXACT_SCORE base 20 pts, auto-scaling OFF",
    20,
    exactPoints,
    "Sin auto-scaling los puntos quedan igual"
  );
}

// Test 10.8: Verifica que TODOS los tipos se escalan proporcionalmente
{
  const baseConfig: PhasePickConfig = {
    phaseId: "quarter_finals",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: true, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: true, points: 10 },
        { key: "PARTIAL_SCORE", enabled: true, points: 8 },
        { key: "TOTAL_GOALS", enabled: true, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
      autoScaling: autoScalingConfig,
    },
  };

  const scaled = applyAutoScalingToConfig(baseConfig, "quarter_finals");
  const diffPoints = scaled.matchPicks?.types.find(t => t.key === "GOAL_DIFFERENCE")?.points ?? 0;

  // quarter_finals → multiplier=2.0 → 10*2.0 = 20
  test(
    "Test 10.8: Escala GOAL_DIFFERENCE también",
    "GOAL_DIFFERENCE base 10 pts, multiplicador x2.0",
    20,
    diffPoints,
    "Todos los tipos se escalan proporcionalmente"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 11: EDGE CASES Y LÍMITES");
console.log("═".repeat(60));
console.log();

// Test 11.1: Marcador alto (>10 goles)
{
  const pick = { homeGoals: 7, awayGoals: 1 }; // 8 goles total
  const result = { homeGoals: 7, awayGoals: 1 }; // Exacto
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  test(
    "Test 11.1: Marcador alto exacto (7-1)",
    "Pick: 7-1, Resultado: 7-1",
    20,
    scoring.totalPoints,
    "Marcadores altos funcionan igual"
  );
}

// Test 11.2: Goleada extrema
{
  const pick = { homeGoals: 10, awayGoals: 0 };
  const result = { homeGoals: 8, awayGoals: 0 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // EXACT: NO
  // DIFF: +10 ≠ +8 → NO
  // PARTIAL: 10≠8 (NO), 0=0 (SÍ) → XOR → SÍ (8)
  // TOTAL: 10 ≠ 8 → NO
  test(
    "Test 11.2: Goleada extrema (parcial visitante)",
    "Pick: 10-0, Resultado: 8-0",
    8,
    scoring.totalPoints,
    "Acertó que el visitante no metería goles"
  );
}

// Test 11.3: Empate con muchos goles
{
  const pick = { homeGoals: 4, awayGoals: 4 }; // diff=0, total=8
  const result = { homeGoals: 3, awayGoals: 3 }; // diff=0, total=6
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // EXACT: NO
  // DIFF: 0 = 0 → SÍ (10)
  // PARTIAL: 4≠3, 4≠3 → NO
  // TOTAL: 8 ≠ 6 → NO
  test(
    "Test 11.3: Empate con muchos goles",
    "Pick: 4-4, Resultado: 3-3 (ambos empate diff=0)",
    10,
    scoring.totalPoints,
    "Ambos empates tienen diferencia 0"
  );
}

// Test 11.4: Verificar que scoreMatchPick retorna estructura correcta
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configAdvancedGroups);

  // Verificar que tiene las propiedades esperadas
  const hasCorrectStructure =
    typeof scoring.totalPoints === "number" &&
    scoring.totalPoints === 20;

  test(
    "Test 11.4: Estructura de respuesta correcta",
    "Verificar que scoring retorna totalPoints correcto",
    1, // true
    hasCorrectStructure ? 1 : 0,
    "scoreMatchPick retorna objeto con totalPoints"
  );
}

// Test 11.5: Config con todos los tipos deshabilitados
{
  const emptyTypesConfig: PhasePickConfig = {
    phaseId: "group_stage",
    requiresScore: true,
    matchPicks: {
      types: [
        { key: "EXACT_SCORE", enabled: false, points: 20 },
        { key: "GOAL_DIFFERENCE", enabled: false, points: 10 },
        { key: "PARTIAL_SCORE", enabled: false, points: 8 },
        { key: "TOTAL_GOALS", enabled: false, points: 5 },
        { key: "MATCH_OUTCOME_90MIN", enabled: false, points: 0 },
      ],
    },
  };

  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, emptyTypesConfig);

  test(
    "Test 11.5: Config con todos tipos deshabilitados",
    "Pick: 2-1, Resultado: 2-1 con ningún tipo habilitado",
    0, // No hay tipos habilitados
    scoring.totalPoints,
    "Sin tipos habilitados, no hay puntos"
  );
}

console.log("═".repeat(60));
console.log("🧪 TEST SUITE 12: SISTEMA ACUMULATIVO (HOME_GOALS + AWAY_GOALS)");
console.log("═".repeat(60));
console.log();

/*
 * SISTEMA ACUMULATIVO:
 * - Los puntos se ACUMULAN por cada criterio cumplido
 * - MATCH_OUTCOME_90MIN: 5 pts (grupos) / 10 pts (eliminatorias)
 * - HOME_GOALS: 2 pts / 4 pts
 * - AWAY_GOALS: 2 pts / 4 pts
 * - GOAL_DIFFERENCE: 1 pt / 2 pts
 * - Total exacto = 5+2+2+1 = 10 pts (grupos) / 10+4+4+2 = 20 pts (eliminatorias)
 */

// Config CUMULATIVE Grupos
const configCumulativeGroups: PhasePickConfig = {
  phaseId: "group_stage",
  phaseName: "Fase de Grupos",
  requiresScore: true,
  matchPicks: {
    types: [
      { key: "EXACT_SCORE", enabled: false, points: 0 },
      { key: "GOAL_DIFFERENCE", enabled: true, points: 1 },
      { key: "PARTIAL_SCORE", enabled: false, points: 0 },
      { key: "TOTAL_GOALS", enabled: false, points: 0 },
      { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 5 },
      { key: "HOME_GOALS", enabled: true, points: 2 },
      { key: "AWAY_GOALS", enabled: true, points: 2 },
    ],
  },
};

// Config CUMULATIVE Eliminatorias (x2)
const configCumulativeKnockout: PhasePickConfig = {
  phaseId: "round_of_16",
  phaseName: "Octavos de Final",
  requiresScore: true,
  matchPicks: {
    types: [
      { key: "EXACT_SCORE", enabled: false, points: 0 },
      { key: "GOAL_DIFFERENCE", enabled: true, points: 2 },
      { key: "PARTIAL_SCORE", enabled: false, points: 0 },
      { key: "TOTAL_GOALS", enabled: false, points: 0 },
      { key: "MATCH_OUTCOME_90MIN", enabled: true, points: 10 },
      { key: "HOME_GOALS", enabled: true, points: 4 },
      { key: "AWAY_GOALS", enabled: true, points: 4 },
    ],
  },
};

// Test 12.1: Marcador exacto (acumula TODO) - Grupos
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 5 pts
  // - HOME_GOALS: 2 = 2 → 2 pts
  // - AWAY_GOALS: 1 = 1 → 2 pts
  // - GOAL_DIFFERENCE: +1 = +1 → 1 pt
  // Total: 5 + 2 + 2 + 1 = 10 pts
  test(
    "Test 12.1: Exacto CUMULATIVE grupos (acumula todo)",
    "Pick: 2-1, Resultado: 2-1",
    10, // 5+2+2+1
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Local(2)+Visitante(2)+Diff(1)=10"
  );
}

// Test 12.2: Marcador exacto (acumula TODO) - Eliminatorias
{
  const pick = { homeGoals: 2, awayGoals: 1 };
  const result = { homeGoals: 2, awayGoals: 1 };
  const scoring = scoreMatchPick(pick, result, configCumulativeKnockout);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 10 pts
  // - HOME_GOALS: 2 = 2 → 4 pts
  // - AWAY_GOALS: 1 = 1 → 4 pts
  // - GOAL_DIFFERENCE: +1 = +1 → 2 pts
  // Total: 10 + 4 + 4 + 2 = 20 pts
  test(
    "Test 12.2: Exacto CUMULATIVE eliminatorias (acumula todo)",
    "Pick: 2-1, Resultado: 2-1",
    20, // 10+4+4+2
    scoring.totalPoints,
    "CUMULATIVE: Outcome(10)+Local(4)+Visitante(4)+Diff(2)=20"
  );
}

// Test 12.3: Solo acertó resultado (outcome) - Grupos
{
  const pick = { homeGoals: 2, awayGoals: 0 }; // HOME wins
  const result = { homeGoals: 3, awayGoals: 1 }; // HOME wins
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 5 pts
  // - HOME_GOALS: 2 ≠ 3 → 0 pts
  // - AWAY_GOALS: 0 ≠ 1 → 0 pts
  // - GOAL_DIFFERENCE: +2 = +2 → 1 pt
  // Total: 5 + 0 + 0 + 1 = 6 pts
  test(
    "Test 12.3: Outcome + Diff correctos (grupos)",
    "Pick: 2-0 (HOME, diff +2), Resultado: 3-1 (HOME, diff +2)",
    6, // 5+1
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Diff(1)=6, goles incorrectos"
  );
}

// Test 12.4: Solo acertó goles del local
{
  const pick = { homeGoals: 2, awayGoals: 1 }; // HOME wins
  const result = { homeGoals: 2, awayGoals: 3 }; // AWAY wins
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME ≠ AWAY → 0 pts
  // - HOME_GOALS: 2 = 2 → 2 pts
  // - AWAY_GOALS: 1 ≠ 3 → 0 pts
  // - GOAL_DIFFERENCE: +1 ≠ -1 → 0 pts
  // Total: 0 + 2 + 0 + 0 = 2 pts
  test(
    "Test 12.4: Solo goles local correctos",
    "Pick: 2-1 (HOME), Resultado: 2-3 (AWAY)",
    2, // Solo LOCAL
    scoring.totalPoints,
    "CUMULATIVE: Solo HOME_GOALS(2)=2"
  );
}

// Test 12.5: Solo acertó goles del visitante
{
  const pick = { homeGoals: 1, awayGoals: 2 }; // AWAY wins
  const result = { homeGoals: 3, awayGoals: 2 }; // HOME wins
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: AWAY ≠ HOME → 0 pts
  // - HOME_GOALS: 1 ≠ 3 → 0 pts
  // - AWAY_GOALS: 2 = 2 → 2 pts
  // - GOAL_DIFFERENCE: -1 ≠ +1 → 0 pts
  // Total: 0 + 0 + 2 + 0 = 2 pts
  test(
    "Test 12.5: Solo goles visitante correctos",
    "Pick: 1-2 (AWAY), Resultado: 3-2 (HOME)",
    2, // Solo VISITANTE
    scoring.totalPoints,
    "CUMULATIVE: Solo AWAY_GOALS(2)=2"
  );
}

// Test 12.6: Empate acertado exacto
{
  const pick = { homeGoals: 1, awayGoals: 1 }; // DRAW
  const result = { homeGoals: 1, awayGoals: 1 }; // DRAW
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: DRAW = DRAW → 5 pts
  // - HOME_GOALS: 1 = 1 → 2 pts
  // - AWAY_GOALS: 1 = 1 → 2 pts
  // - GOAL_DIFFERENCE: 0 = 0 → 1 pt
  // Total: 5 + 2 + 2 + 1 = 10 pts
  test(
    "Test 12.6: Empate 1-1 exacto",
    "Pick: 1-1 (DRAW), Resultado: 1-1 (DRAW)",
    10, // 5+2+2+1
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Local(2)+Visitante(2)+Diff(1)=10"
  );
}

// Test 12.7: Empate resultado pero diferente marcador
{
  const pick = { homeGoals: 1, awayGoals: 1 }; // DRAW, total=2
  const result = { homeGoals: 2, awayGoals: 2 }; // DRAW, total=4
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: DRAW = DRAW → 5 pts
  // - HOME_GOALS: 1 ≠ 2 → 0 pts
  // - AWAY_GOALS: 1 ≠ 2 → 0 pts
  // - GOAL_DIFFERENCE: 0 = 0 → 1 pt
  // Total: 5 + 0 + 0 + 1 = 6 pts
  test(
    "Test 12.7: Empate diferente marcador",
    "Pick: 1-1 (DRAW, diff=0), Resultado: 2-2 (DRAW, diff=0)",
    6, // 5+1
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Diff(1)=6, goles no coinciden"
  );
}

// Test 12.8: Nada correcto
{
  const pick = { homeGoals: 3, awayGoals: 0 }; // HOME, diff=+3
  const result = { homeGoals: 1, awayGoals: 2 }; // AWAY, diff=-1
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME ≠ AWAY → 0 pts
  // - HOME_GOALS: 3 ≠ 1 → 0 pts
  // - AWAY_GOALS: 0 ≠ 2 → 0 pts
  // - GOAL_DIFFERENCE: +3 ≠ -1 → 0 pts
  // Total: 0 pts
  test(
    "Test 12.8: Nada correcto",
    "Pick: 3-0 (HOME), Resultado: 1-2 (AWAY)",
    0,
    scoring.totalPoints,
    "CUMULATIVE: Todo incorrecto = 0"
  );
}

// Test 12.9: Goleada 5-0 predicha, resultado 5-1
{
  const pick = { homeGoals: 5, awayGoals: 0 }; // HOME, diff=+5
  const result = { homeGoals: 5, awayGoals: 1 }; // HOME, diff=+4
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 5 pts
  // - HOME_GOALS: 5 = 5 → 2 pts
  // - AWAY_GOALS: 0 ≠ 1 → 0 pts
  // - GOAL_DIFFERENCE: +5 ≠ +4 → 0 pts
  // Total: 5 + 2 + 0 + 0 = 7 pts
  test(
    "Test 12.9: Goleada casi exacta",
    "Pick: 5-0 (HOME), Resultado: 5-1 (HOME)",
    7, // 5+2
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Local(5=5)=7"
  );
}

// Test 12.10: Solo diferencia correcta (caso raro)
{
  const pick = { homeGoals: 1, awayGoals: 0 }; // HOME, diff=+1
  const result = { homeGoals: 3, awayGoals: 2 }; // HOME, diff=+1
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 5 pts
  // - HOME_GOALS: 1 ≠ 3 → 0 pts
  // - AWAY_GOALS: 0 ≠ 2 → 0 pts
  // - GOAL_DIFFERENCE: +1 = +1 → 1 pt
  // Total: 5 + 0 + 0 + 1 = 6 pts
  test(
    "Test 12.10: Resultado y diferencia correctos",
    "Pick: 1-0 (HOME, +1), Resultado: 3-2 (HOME, +1)",
    6, // 5+1
    scoring.totalPoints,
    "CUMULATIVE: Outcome(5)+Diff(1)=6"
  );
}

// Test 12.11: Acertó ambos goles pero no resultado ni diferencia
{
  // Caso especial: acertar HOME_GOALS y AWAY_GOALS pero NO el outcome
  // Esto es imposible matemáticamente si los goles coinciden
  // Si homeGoals coincide Y awayGoals coincide → es marcador exacto
  // Por lo tanto, este test verifica que marcador exacto = acumula todo
  const pick = { homeGoals: 2, awayGoals: 2 }; // DRAW
  const result = { homeGoals: 2, awayGoals: 2 }; // DRAW
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  test(
    "Test 12.11: Empate 2-2 exacto",
    "Pick: 2-2 (DRAW), Resultado: 2-2 (DRAW)",
    10, // 5+2+2+1
    scoring.totalPoints,
    "CUMULATIVE: Si ambos goles coinciden, todo coincide"
  );
}

// Test 12.12: Eliminatorias - Caso parcial
{
  const pick = { homeGoals: 1, awayGoals: 0 }; // HOME, diff=+1
  const result = { homeGoals: 2, awayGoals: 1 }; // HOME, diff=+1
  const scoring = scoreMatchPick(pick, result, configCumulativeKnockout);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 10 pts
  // - HOME_GOALS: 1 ≠ 2 → 0 pts
  // - AWAY_GOALS: 0 ≠ 1 → 0 pts
  // - GOAL_DIFFERENCE: +1 = +1 → 2 pts
  // Total: 10 + 0 + 0 + 2 = 12 pts
  test(
    "Test 12.12: Eliminatorias - Outcome + Diff",
    "Pick: 1-0 (HOME, +1), Resultado: 2-1 (HOME, +1)",
    12, // 10+2
    scoring.totalPoints,
    "CUMULATIVE Eliminatorias: Outcome(10)+Diff(2)=12"
  );
}

// Test 12.13: Victoria del local sin acertar goles
{
  const pick = { homeGoals: 4, awayGoals: 1 }; // HOME, diff=+3
  const result = { homeGoals: 2, awayGoals: 0 }; // HOME, diff=+2
  const scoring = scoreMatchPick(pick, result, configCumulativeGroups);

  // Manual:
  // - MATCH_OUTCOME_90MIN: HOME = HOME → 5 pts
  // - HOME_GOALS: 4 ≠ 2 → 0 pts
  // - AWAY_GOALS: 1 ≠ 0 → 0 pts
  // - GOAL_DIFFERENCE: +3 ≠ +2 → 0 pts
  // Total: 5 pts
  test(
    "Test 12.13: Solo resultado correcto (HOME win)",
    "Pick: 4-1 (HOME, +3), Resultado: 2-0 (HOME, +2)",
    5,
    scoring.totalPoints,
    "CUMULATIVE: Solo Outcome(5)"
  );
}

// ==================== RESUMEN FINAL ====================

console.log("═".repeat(60));
console.log("📊 RESUMEN DE RESULTADOS");
console.log("═".repeat(60));
console.log();

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total de tests: ${total}`);
console.log(`✅ Pasaron: ${passed}`);
console.log(`❌ Fallaron: ${failed}`);
console.log();

if (failed > 0) {
  console.log("⚠️  TESTS FALLIDOS:");
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   - ${r.name}`);
    console.log(`     Esperado: ${r.expected}, Obtenido: ${r.actual}`);
  });
  console.log();
}

const successRate = Math.round((passed / total) * 100);
console.log(`📈 Tasa de éxito: ${successRate}%`);

if (failed === 0) {
  console.log();
  console.log("🎉 ¡TODOS LOS TESTS PASARON!");
  console.log("   El sistema de scoring funciona correctamente.");
} else {
  console.log();
  console.log("🔴 HAY ERRORES EN EL SISTEMA DE SCORING");
  console.log("   Revisar la lógica de los tests fallidos.");
  process.exitCode = 1;
}
