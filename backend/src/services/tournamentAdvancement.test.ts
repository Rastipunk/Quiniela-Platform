import { describe, it, expect } from "vitest";
import {
  calculateGroupStandings,
  rankThirdPlaceTeams,
  determineQualifiers,
  resolvePlaceholders,
  determineTwoLeggedTieWinner,
  resolveKnockoutPlaceholders,
  type TeamStanding,
} from "./tournamentAdvancement";

// ─── calculateGroupStandings ─────────────────────────────────

describe("calculateGroupStandings", () => {
  const groupId = "A";
  const teams = ["team1", "team2", "team3", "team4"];

  it("calculates correct points for wins, draws, and losses", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 2, awayGoals: 0 },
      { matchId: "m2", homeTeamId: "team3", awayTeamId: "team4", homeGoals: 1, awayGoals: 1 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);

    const t1 = standings.find((s) => s.teamId === "team1")!;
    const t2 = standings.find((s) => s.teamId === "team2")!;
    const t3 = standings.find((s) => s.teamId === "team3")!;
    const t4 = standings.find((s) => s.teamId === "team4")!;

    expect(t1.points).toBe(3);
    expect(t1.won).toBe(1);
    expect(t2.points).toBe(0);
    expect(t2.lost).toBe(1);
    expect(t3.points).toBe(1);
    expect(t3.drawn).toBe(1);
    expect(t4.points).toBe(1);
    expect(t4.drawn).toBe(1);
  });

  it("sorts teams by points (descending)", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 3, awayGoals: 0 },
      { matchId: "m2", homeTeamId: "team3", awayTeamId: "team4", homeGoals: 0, awayGoals: 2 },
      { matchId: "m3", homeTeamId: "team1", awayTeamId: "team3", homeGoals: 1, awayGoals: 0 },
      { matchId: "m4", homeTeamId: "team2", awayTeamId: "team4", homeGoals: 0, awayGoals: 1 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);

    expect(standings[0].teamId).toBe("team1"); // 6 pts
    expect(standings[1].teamId).toBe("team4"); // 6 pts but GD = +3 vs +4
    // team1 GD = +4, team4 GD = +3
    expect(standings[0].points).toBe(6);
    expect(standings[1].points).toBe(6);
  });

  it("breaks ties by goal difference", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 3, awayGoals: 0 },
      { matchId: "m2", homeTeamId: "team3", awayTeamId: "team4", homeGoals: 1, awayGoals: 0 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);

    // team1: 3pts, GD +3 ; team3: 3pts, GD +1
    expect(standings[0].teamId).toBe("team1");
    expect(standings[1].teamId).toBe("team3");
  });

  it("breaks ties by goals scored when GD is equal", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 3, awayGoals: 1 },
      { matchId: "m2", homeTeamId: "team3", awayTeamId: "team4", homeGoals: 4, awayGoals: 2 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);

    // team1: 3pts, GD +2, GF 3 ; team3: 3pts, GD +2, GF 4
    expect(standings[0].teamId).toBe("team3");
    expect(standings[1].teamId).toBe("team1");
  });

  it("assigns correct positions (1-based)", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 2, awayGoals: 0 },
      { matchId: "m2", homeTeamId: "team3", awayTeamId: "team4", homeGoals: 1, awayGoals: 0 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);

    expect(standings[0].position).toBe(1);
    expect(standings[1].position).toBe(2);
    expect(standings[2].position).toBe(3);
    expect(standings[3].position).toBe(4);
  });

  it("calculates goal difference correctly", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 5, awayGoals: 2 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);
    const t1 = standings.find((s) => s.teamId === "team1")!;
    const t2 = standings.find((s) => s.teamId === "team2")!;

    expect(t1.goalDifference).toBe(3);
    expect(t1.goalsFor).toBe(5);
    expect(t1.goalsAgainst).toBe(2);
    expect(t2.goalDifference).toBe(-3);
  });

  it("handles 0-0 draws correctly", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 0, awayGoals: 0 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);
    const t1 = standings.find((s) => s.teamId === "team1")!;

    expect(t1.points).toBe(1);
    expect(t1.drawn).toBe(1);
    expect(t1.goalsFor).toBe(0);
    expect(t1.goalDifference).toBe(0);
  });

  it("returns empty standings when no matches played", () => {
    const standings = calculateGroupStandings(groupId, teams, []);

    expect(standings).toHaveLength(4);
    standings.forEach((s) => {
      expect(s.played).toBe(0);
      expect(s.points).toBe(0);
    });
  });

  it("skips matches with unknown teams", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "unknown", homeGoals: 2, awayGoals: 0 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);
    const t1 = standings.find((s) => s.teamId === "team1")!;

    // match is skipped because "unknown" not in teams
    expect(t1.played).toBe(0);
  });

  it("tracks played count across multiple matches", () => {
    const results = [
      { matchId: "m1", homeTeamId: "team1", awayTeamId: "team2", homeGoals: 1, awayGoals: 0 },
      { matchId: "m2", homeTeamId: "team1", awayTeamId: "team3", homeGoals: 2, awayGoals: 1 },
      { matchId: "m3", homeTeamId: "team1", awayTeamId: "team4", homeGoals: 0, awayGoals: 0 },
    ];
    const standings = calculateGroupStandings(groupId, teams, results);
    const t1 = standings.find((s) => s.teamId === "team1")!;

    expect(t1.played).toBe(3);
    expect(t1.won).toBe(2);
    expect(t1.drawn).toBe(1);
    expect(t1.lost).toBe(0);
    expect(t1.points).toBe(7);
  });
});

// ─── rankThirdPlaceTeams ─────────────────────────────────────

describe("rankThirdPlaceTeams", () => {
  function makeThird(
    teamId: string,
    groupId: string,
    points: number,
    gd: number,
    gf: number,
  ): TeamStanding {
    return {
      teamId, groupId, position: 3,
      played: 3, won: 0, drawn: points, lost: 0,
      goalsFor: gf, goalsAgainst: gf - gd, goalDifference: gd, points,
    };
  }

  it("ranks by points first", () => {
    const thirds = [
      makeThird("t1", "A", 3, 0, 2),
      makeThird("t2", "B", 6, 0, 2),
    ];
    const ranked = rankThirdPlaceTeams(thirds);
    expect(ranked[0].teamId).toBe("t2");
    expect(ranked[0].rankAcrossGroups).toBe(1);
  });

  it("breaks tie by goal difference", () => {
    const thirds = [
      makeThird("t1", "A", 4, 1, 3),
      makeThird("t2", "B", 4, 3, 5),
    ];
    const ranked = rankThirdPlaceTeams(thirds);
    expect(ranked[0].teamId).toBe("t2");
  });

  it("breaks tie by goals scored when GD equal", () => {
    const thirds = [
      makeThird("t1", "A", 4, 2, 3),
      makeThird("t2", "B", 4, 2, 5),
    ];
    const ranked = rankThirdPlaceTeams(thirds);
    expect(ranked[0].teamId).toBe("t2");
  });

  it("falls back to alphabetical groupId on full tie", () => {
    const thirds = [
      makeThird("t1", "B", 4, 2, 3),
      makeThird("t2", "A", 4, 2, 3),
    ];
    const ranked = rankThirdPlaceTeams(thirds);
    expect(ranked[0].teamId).toBe("t2"); // group A < group B
  });

  it("assigns rankAcrossGroups sequentially", () => {
    const thirds = [
      makeThird("t1", "A", 6, 0, 0),
      makeThird("t2", "B", 4, 0, 0),
      makeThird("t3", "C", 2, 0, 0),
    ];
    const ranked = rankThirdPlaceTeams(thirds);
    expect(ranked.map((t) => t.rankAcrossGroups)).toEqual([1, 2, 3]);
  });
});

// ─── determineQualifiers ─────────────────────────────────────

describe("determineQualifiers", () => {
  function makeStandings(groupId: string, teamIds: string[]): TeamStanding[] {
    return teamIds.map((teamId, i) => ({
      teamId, groupId, position: i + 1,
      played: 3, won: 3 - i, drawn: 0, lost: i,
      goalsFor: 6 - i, goalsAgainst: i, goalDifference: 6 - 2 * i,
      points: (3 - i) * 3,
    }));
  }

  it("extracts winners and runners-up from each group", () => {
    const allStandings = new Map<string, TeamStanding[]>();
    allStandings.set("A", makeStandings("A", ["a1", "a2", "a3", "a4"]));
    allStandings.set("B", makeStandings("B", ["b1", "b2", "b3", "b4"]));

    const { winners, runnersUp } = determineQualifiers(allStandings);

    expect(winners.get("A")).toBe("a1");
    expect(winners.get("B")).toBe("b1");
    expect(runnersUp.get("A")).toBe("a2");
    expect(runnersUp.get("B")).toBe("b2");
  });

  it("selects best 8 third-place teams from 12 groups", () => {
    const allStandings = new Map<string, TeamStanding[]>();
    const groupLetters = "ABCDEFGHIJKL".split("");
    groupLetters.forEach((g, i) => {
      const teams = [`${g}1`, `${g}2`, `${g}3`, `${g}4`];
      const standings = makeStandings(g, teams);
      // Vary third-place points so ranking is deterministic
      standings[2].points = 12 - i;
      allStandings.set(g, standings);
    });

    const { bestThirds } = determineQualifiers(allStandings);

    expect(bestThirds).toHaveLength(8);
    // Best third should be from group A (highest points = 12)
    expect(bestThirds[0].teamId).toBe("A3");
  });

  it("returns fewer bestThirds if fewer than 12 groups", () => {
    const allStandings = new Map<string, TeamStanding[]>();
    allStandings.set("A", makeStandings("A", ["a1", "a2", "a3", "a4"]));

    const { bestThirds } = determineQualifiers(allStandings);
    expect(bestThirds).toHaveLength(1); // only 1 group, 1 third
  });
});

// ─── resolvePlaceholders ─────────────────────────────────────

describe("resolvePlaceholders", () => {
  it("resolves W_ placeholders to group winners", () => {
    const matches = [{ id: "m1", homeTeamId: "W_A", awayTeamId: "W_B" }];
    const winners = new Map([["A", "brazil"], ["B", "germany"]]);
    const runnersUp = new Map<string, string>();

    const resolved = resolvePlaceholders(matches, winners, runnersUp, []);

    expect(resolved[0].homeTeamId).toBe("brazil");
    expect(resolved[0].awayTeamId).toBe("germany");
  });

  it("resolves RU_ placeholders to runners-up", () => {
    const matches = [{ id: "m1", homeTeamId: "RU_C", awayTeamId: "RU_D" }];
    const winners = new Map<string, string>();
    const runnersUp = new Map([["C", "france"], ["D", "spain"]]);

    const resolved = resolvePlaceholders(matches, winners, runnersUp, []);

    expect(resolved[0].homeTeamId).toBe("france");
    expect(resolved[0].awayTeamId).toBe("spain");
  });

  it("resolves 3rd_POOL_ placeholders to best thirds", () => {
    const matches = [{ id: "m1", homeTeamId: "3rd_POOL_1", awayTeamId: "3rd_POOL_2" }];
    const bestThirds = [
      { teamId: "japan", groupId: "E", rankAcrossGroups: 1 } as any,
      { teamId: "korea", groupId: "F", rankAcrossGroups: 2 } as any,
    ];

    const resolved = resolvePlaceholders(matches, new Map(), new Map(), bestThirds);

    expect(resolved[0].homeTeamId).toBe("japan");
    expect(resolved[0].awayTeamId).toBe("korea");
  });

  it("keeps unresolved placeholder if no match found", () => {
    const matches = [{ id: "m1", homeTeamId: "W_Z", awayTeamId: "RU_Z" }];

    const resolved = resolvePlaceholders(matches, new Map(), new Map(), []);

    expect(resolved[0].homeTeamId).toBe("W_Z");
    expect(resolved[0].awayTeamId).toBe("RU_Z");
  });

  it("leaves normal team IDs unchanged", () => {
    const matches = [{ id: "m1", homeTeamId: "brazil", awayTeamId: "germany" }];

    const resolved = resolvePlaceholders(matches, new Map(), new Map(), []);

    expect(resolved[0].homeTeamId).toBe("brazil");
    expect(resolved[0].awayTeamId).toBe("germany");
  });
});

// ─── determineTwoLeggedTieWinner ─────────────────────────────

describe("determineTwoLeggedTieWinner", () => {
  it("teamA wins on aggregate", () => {
    const leg1 = { matchId: "l1", homeGoals: 3, awayGoals: 1 };
    const leg2 = { matchId: "l2", homeGoals: 0, awayGoals: 1 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1);

    // A agg = 3 + 1 = 4, B agg = 1 + 0 = 1
    expect(result.winnerId).toBe("A");
    expect(result.decidedBy).toBe("AGGREGATE");
    expect(result.teamAAgg).toBe(4);
    expect(result.teamBAgg).toBe(1);
  });

  it("teamB wins on aggregate", () => {
    const leg1 = { matchId: "l1", homeGoals: 0, awayGoals: 2 };
    const leg2 = { matchId: "l2", homeGoals: 3, awayGoals: 0 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1);

    // A agg = 0 + 0 = 0, B agg = 2 + 3 = 5
    expect(result.winnerId).toBe("B");
    expect(result.decidedBy).toBe("AGGREGATE");
  });

  it("decides by penalties when aggregate is tied", () => {
    const leg1 = { matchId: "l1", homeGoals: 1, awayGoals: 1 };
    const leg2 = { matchId: "l2", homeGoals: 1, awayGoals: 1, homePenalties: 5, awayPenalties: 3 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1);

    // Aggregate 2-2, penalties: home(B)=5, away(A)=3 → B wins
    expect(result.winnerId).toBe("B");
    expect(result.decidedBy).toBe("PENALTIES");
  });

  it("teamA wins on penalties (away in leg2)", () => {
    const leg1 = { matchId: "l1", homeGoals: 2, awayGoals: 0 };
    const leg2 = { matchId: "l2", homeGoals: 2, awayGoals: 0, homePenalties: 3, awayPenalties: 4 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1);

    // A agg = 2 + 0 = 2, B agg = 0 + 2 = 2. Pens: away(A)=4 > home(B)=3
    expect(result.winnerId).toBe("A");
    expect(result.decidedBy).toBe("PENALTIES");
  });

  it("throws on tied aggregate without penalties", () => {
    const leg1 = { matchId: "l1", homeGoals: 1, awayGoals: 1 };
    const leg2 = { matchId: "l2", homeGoals: 1, awayGoals: 1 };

    expect(() => determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1)).toThrow(
      /aggregate empatado.*no hay penalties/,
    );
  });

  it("throws on equal penalties (impossible scenario)", () => {
    const leg1 = { matchId: "l1", homeGoals: 1, awayGoals: 1 };
    const leg2 = { matchId: "l2", homeGoals: 1, awayGoals: 1, homePenalties: 4, awayPenalties: 4 };

    expect(() => determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1)).toThrow(
      /penalties empatados/,
    );
  });

  it("includes tieNumber in result", () => {
    const leg1 = { matchId: "l1", homeGoals: 2, awayGoals: 0 };
    const leg2 = { matchId: "l2", homeGoals: 0, awayGoals: 0 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 7);
    expect(result.tieNumber).toBe(7);
  });

  it("identifies the loser correctly", () => {
    const leg1 = { matchId: "l1", homeGoals: 3, awayGoals: 0 };
    const leg2 = { matchId: "l2", homeGoals: 0, awayGoals: 0 };

    const result = determineTwoLeggedTieWinner(leg1, leg2, "A", "B", 1);
    expect(result.winnerId).toBe("A");
    expect(result.loserId).toBe("B");
  });
});

// ─── resolveKnockoutPlaceholders ─────────────────────────────

describe("resolveKnockoutPlaceholders", () => {
  it("resolves W_ prefix to winner of previous match", () => {
    const matches = [{ id: "qf1", homeTeamId: "W_R32_1", awayTeamId: "W_R32_2" }];
    const results = new Map([
      ["m_R32_1", { winnerId: "brazil", loserId: "japan" }],
      ["m_R32_2", { winnerId: "germany", loserId: "korea" }],
    ]);

    const resolved = resolveKnockoutPlaceholders(matches, results);

    expect(resolved[0].homeTeamId).toBe("brazil");
    expect(resolved[0].awayTeamId).toBe("germany");
  });

  it("resolves L_ prefix to loser of previous match", () => {
    const matches = [{ id: "3rd", homeTeamId: "L_SF_1", awayTeamId: "L_SF_2" }];
    const results = new Map([
      ["m_SF_1", { winnerId: "brazil", loserId: "france" }],
      ["m_SF_2", { winnerId: "germany", loserId: "spain" }],
    ]);

    const resolved = resolveKnockoutPlaceholders(matches, results);

    expect(resolved[0].homeTeamId).toBe("france");
    expect(resolved[0].awayTeamId).toBe("spain");
  });

  it("keeps unresolved placeholders", () => {
    const matches = [{ id: "f1", homeTeamId: "W_QF_99", awayTeamId: "L_QF_99" }];

    const resolved = resolveKnockoutPlaceholders(matches, new Map());

    expect(resolved[0].homeTeamId).toBe("W_QF_99");
    expect(resolved[0].awayTeamId).toBe("L_QF_99");
  });

  it("leaves already-resolved team IDs unchanged", () => {
    const matches = [{ id: "f1", homeTeamId: "brazil", awayTeamId: "germany" }];

    const resolved = resolveKnockoutPlaceholders(matches, new Map());

    expect(resolved[0].homeTeamId).toBe("brazil");
    expect(resolved[0].awayTeamId).toBe("germany");
  });
});
