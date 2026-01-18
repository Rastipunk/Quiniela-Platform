// backend/src/wc2026Sandbox.ts
import type { TemplateData } from "./schemas/templateData";

export function buildWc2026Sandbox(): TemplateData {
  const groups = "ABCDEFGHIJKL".split("");

  // 48 equipos placeholder (4 por grupo)
  const teams = groups.flatMap((g) => {
    return [1, 2, 3, 4].map((n) => ({
      id: `g${g}t${n}`,          // ej: gAt1
      name: `Equipo ${g}${n}`,  // placeholder
      shortName: `${g}${n}`,
      code: `${g}${n}`,         // corto para UI
      groupId: g,

      // Base futura (opcional): para banderas más adelante
      // countryCode: "CO", // ISO2 cuando sea real
      // flagEmoji: "🇨🇴",
    }));
  });

  const phases = [
    { id: "group_stage", name: "Fase de grupos", type: "GROUP" as const, order: 1 },
  ];

  // 6 partidos por grupo (round-robin 4 equipos)
  const pairings = [
    [1, 2],
    [3, 4],
    [1, 3],
    [2, 4],
    [1, 4],
    [2, 3],
  ] as const;

  // kickoff base (futuro para que esté OPEN)
  const base = new Date("2026-06-11T18:00:00Z").getTime();
  let matchSeq = 1;

  const matches = groups.flatMap((g, gi) => {
    return pairings.map(([a, b], pi) => {
      const kickoff = new Date(base + (gi * 6 + pi) * 60 * 60 * 1000).toISOString(); // 1h de diferencia
      const matchNumber = matchSeq++;

      return {
        id: `wc26_g${g}_m${pi + 1}`,   // id estable
        phaseId: "group_stage",
        kickoffUtc: kickoff,
        homeTeamId: `g${g}t${a}`,
        awayTeamId: `g${g}t${b}`,
        matchNumber,
        roundLabel: `Grupo ${g} - J${pi < 2 ? 1 : pi < 4 ? 2 : 3}`,
        venue: `Sede ${gi + 1}`,
        groupId: g,
      };
    });
  });

  return {
    meta: {
      name: "WC 2026 Sandbox",
      competition: "FIFA World Cup",
      seasonYear: 2026,
      sport: "football",
    },
    teams,
    phases,
    matches,
    note: "Sandbox para UX de volumen. Equipos/fechas placeholder.",
  };
}
