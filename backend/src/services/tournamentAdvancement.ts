// backend/src/services/tournamentAdvancement.ts
/**
 * Servicio para manejar el avance automático en torneos con fases de grupos y eliminatorias.
 * Específicamente diseñado para FIFA World Cup 2026 con 48 equipos.
 */

export type TeamStanding = {
  teamId: string;
  groupId: string;
  position: number; // 1, 2, 3, 4
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fairPlayPoints?: number; // Opcional: para desempate por fair play
};

type GroupResults = {
  groupId: string;
  matches: Array<{
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeGoals: number;
    awayGoals: number;
  }>;
};

type ThirdPlaceTeam = TeamStanding & {
  groupId: string;
  rankAcrossGroups: number;
};

/**
 * Calcula la tabla de posiciones de un grupo basado en los resultados.
 * Criterios FIFA:
 * 1. Puntos (3 por victoria, 1 por empate, 0 por derrota)
 * 2. Diferencia de goles
 * 3. Goles a favor
 * 4. Fair play points (si disponible)
 * 5. Sorteo (no implementado - requiere intervención manual)
 */
export function calculateGroupStandings(
  groupId: string,
  teamIds: string[],
  results: GroupResults['matches']
): TeamStanding[] {
  // Inicializar estadísticas para cada equipo
  const standings = new Map<string, TeamStanding>();

  for (const teamId of teamIds) {
    standings.set(teamId, {
      teamId,
      groupId,
      position: 0, // Se calcula después
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  // Procesar cada resultado
  for (const result of results) {
    const home = standings.get(result.homeTeamId);
    const away = standings.get(result.awayTeamId);

    if (!home || !away) {
      console.warn(`Team not found in group ${groupId}:`, result);
      continue;
    }

    // Actualizar estadísticas
    home.played++;
    away.played++;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;

    if (result.homeGoals > result.awayGoals) {
      // Victoria local
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (result.homeGoals < result.awayGoals) {
      // Victoria visitante
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      // Empate
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }

    // Actualizar diferencia de goles
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  // Convertir a array y ordenar
  const standingsArray = Array.from(standings.values());

  standingsArray.sort((a, b) => {
    // 1. Puntos (mayor a menor)
    if (b.points !== a.points) return b.points - a.points;

    // 2. Diferencia de goles (mayor a menor)
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

    // 3. Goles a favor (mayor a menor)
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // 4. Fair play points (si disponible)
    if (a.fairPlayPoints !== undefined && b.fairPlayPoints !== undefined) {
      if (b.fairPlayPoints !== a.fairPlayPoints) return b.fairPlayPoints - a.fairPlayPoints;
    }

    // 5. Sorteo (retornar 0 = no cambiar orden, requiere intervención manual)
    return 0;
  });

  // Asignar posiciones
  standingsArray.forEach((team, index) => {
    team.position = index + 1;
  });

  return standingsArray;
}

/**
 * Rankea todos los terceros lugares de todos los grupos.
 * Los mejores 8 terceros avanzan a Round of 32.
 *
 * Criterios FIFA para terceros lugares:
 * 1. Puntos
 * 2. Diferencia de goles
 * 3. Goles a favor
 * 4. Fair play points
 * 5. Sorteo
 */
export function rankThirdPlaceTeams(allThirds: TeamStanding[]): ThirdPlaceTeam[] {
  const ranked = [...allThirds].sort((a, b) => {
    // 1. Puntos
    if (b.points !== a.points) return b.points - a.points;

    // 2. Diferencia de goles
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

    // 3. Goles a favor
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // 4. Fair play points
    if (a.fairPlayPoints !== undefined && b.fairPlayPoints !== undefined) {
      if (b.fairPlayPoints !== a.fairPlayPoints) return b.fairPlayPoints - a.fairPlayPoints;
    }

    // 5. Sorteo (alfabético por groupId como fallback)
    return a.groupId.localeCompare(b.groupId);
  });

  // Asignar ranking across groups
  return ranked.map((team, index) => ({
    ...team,
    rankAcrossGroups: index + 1,
  }));
}

/**
 * Determina qué equipos avanzan de la fase de grupos.
 * Para WC2026: 12 winners + 12 runners-up + 8 best thirds = 32 equipos
 */
export function determineQualifiers(
  allGroupStandings: Map<string, TeamStanding[]>
): {
  winners: Map<string, string>; // groupId -> teamId
  runnersUp: Map<string, string>; // groupId -> teamId
  bestThirds: ThirdPlaceTeam[]; // Ordenados del 1° al 8°
} {
  const winners = new Map<string, string>();
  const runnersUp = new Map<string, string>();
  const allThirds: TeamStanding[] = [];

  // Extraer winners, runners-up y thirds de cada grupo
  for (const [groupId, standings] of allGroupStandings) {
    const first = standings.find((t) => t.position === 1);
    const second = standings.find((t) => t.position === 2);
    const third = standings.find((t) => t.position === 3);

    if (first) winners.set(groupId, first.teamId);
    if (second) runnersUp.set(groupId, second.teamId);
    if (third) allThirds.push(third);
  }

  // Rankear todos los terceros lugares
  const rankedThirds = rankThirdPlaceTeams(allThirds);

  // Tomar los mejores 8
  const bestThirds = rankedThirds.slice(0, 8);

  return { winners, runnersUp, bestThirds };
}

/**
 * Resuelve los placeholders del Round of 32 con los equipos clasificados.
 *
 * Formato de placeholders:
 * - W_A, W_B, etc. -> Winner of Group A, B, etc.
 * - RU_A, RU_B, etc. -> Runner-up of Group A, B, etc.
 * - 3rd_POOL_1 through 3rd_POOL_8 -> Best third place teams ranked 1-8
 */
export function resolvePlaceholders(
  matches: Array<{ id: string; homeTeamId: string; awayTeamId: string }>,
  winners: Map<string, string>,
  runnersUp: Map<string, string>,
  bestThirds: ThirdPlaceTeam[]
): Array<{ matchId: string; homeTeamId: string; awayTeamId: string }> {
  const resolved = [];

  for (const match of matches) {
    let homeTeamId = match.homeTeamId;
    let awayTeamId = match.awayTeamId;

    // Resolver home team
    if (homeTeamId.startsWith('W_')) {
      const groupId = homeTeamId.replace('W_', '');
      homeTeamId = winners.get(groupId) || homeTeamId;
    } else if (homeTeamId.startsWith('RU_')) {
      const groupId = homeTeamId.replace('RU_', '');
      homeTeamId = runnersUp.get(groupId) || homeTeamId;
    } else if (homeTeamId.startsWith('3rd_POOL_')) {
      const rank = parseInt(homeTeamId.replace('3rd_POOL_', ''));
      const thirdTeam = bestThirds[rank - 1];
      homeTeamId = thirdTeam?.teamId || homeTeamId;
    }

    // Resolver away team
    if (awayTeamId.startsWith('W_')) {
      const groupId = awayTeamId.replace('W_', '');
      awayTeamId = winners.get(groupId) || awayTeamId;
    } else if (awayTeamId.startsWith('RU_')) {
      const groupId = awayTeamId.replace('RU_', '');
      awayTeamId = runnersUp.get(groupId) || awayTeamId;
    } else if (awayTeamId.startsWith('3rd_POOL_')) {
      const rank = parseInt(awayTeamId.replace('3rd_POOL_', ''));
      const thirdTeam = bestThirds[rank - 1];
      awayTeamId = thirdTeam?.teamId || awayTeamId;
    }

    resolved.push({
      matchId: match.id,
      homeTeamId,
      awayTeamId,
    });
  }

  return resolved;
}

/**
 * Resuelve placeholders de rondas posteriores basados en ganadores de rondas previas.
 * Ejemplos:
 * - W_R32_1 -> Winner of Round of 32, Match 1
 * - L_SF_1 -> Loser of Semi-final 1
 */
export function resolveKnockoutPlaceholders(
  matches: Array<{ id: string; homeTeamId: string; awayTeamId: string }>,
  results: Map<string, { winnerId: string; loserId: string }>
): Array<{ matchId: string; homeTeamId: string; awayTeamId: string }> {
  const resolved = [];

  for (const match of matches) {
    let homeTeamId = match.homeTeamId;
    let awayTeamId = match.awayTeamId;

    // Resolver home team
    if (homeTeamId.startsWith('W_')) {
      const matchId = homeTeamId.replace('W_', 'm_');
      const result = results.get(matchId);
      homeTeamId = result?.winnerId || homeTeamId;
    } else if (homeTeamId.startsWith('L_')) {
      const matchId = homeTeamId.replace('L_', 'm_');
      const result = results.get(matchId);
      homeTeamId = result?.loserId || homeTeamId;
    }

    // Resolver away team
    if (awayTeamId.startsWith('W_')) {
      const matchId = awayTeamId.replace('W_', 'm_');
      const result = results.get(matchId);
      awayTeamId = result?.winnerId || awayTeamId;
    } else if (awayTeamId.startsWith('L_')) {
      const matchId = awayTeamId.replace('L_', 'm_');
      const result = results.get(matchId);
      awayTeamId = result?.loserId || awayTeamId;
    }

    resolved.push({
      matchId: match.id,
      homeTeamId,
      awayTeamId,
    });
  }

  return resolved;
}
