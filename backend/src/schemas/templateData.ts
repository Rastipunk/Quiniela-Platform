import { z } from "zod";

// Comentario en español: esquema del snapshot completo del torneo dentro de TemplateVersion.dataJson

export const templateTeamSchema = z.object({
  id: z.string().min(1).max(50), // ej: "mex", "usa", "t1"
  name: z.string().min(1).max(120),
  shortName: z.string().min(1).max(20).optional(),
  code: z.string().min(2).max(6).optional(), // ej: "MEX"
  groupId: z.string().min(1).max(50).optional(), // ej: "A"
});

export const templatePhaseSchema = z.object({
  id: z.string().min(1).max(50), // ej: "group_stage", "r16"
  name: z.string().min(1).max(120),
  type: z.enum(["GROUP", "KNOCKOUT"]),
  order: z.number().int().min(1).max(99),
  // Comentario en español: configuración simple; luego la refinamos
  config: z
    .object({
      groupsCount: z.number().int().min(1).max(64).optional(),
      teamsPerGroup: z.number().int().min(2).max(8).optional(),
      legs: z.number().int().min(1).max(2).optional(),
    })
    .optional(),
});

export const templateMatchSchema = z.object({
  id: z.string().min(1).max(50), // ej: "m1"
  phaseId: z.string().min(1).max(50),
  kickoffUtc: z.string().datetime(), // ISO 8601, ej: "2026-06-11T23:00:00Z"
  homeTeamId: z.string().min(1).max(50),
  awayTeamId: z.string().min(1).max(50),

  matchNumber: z.number().int().min(1).optional(),
  roundLabel: z.string().min(1).max(50).optional(), // ej: "Group A - Matchday 1"
  venue: z.string().min(1).max(120).optional(),
  groupId: z.string().min(1).max(50).optional(), // para GROUP
});

export const templateDataSchema = z.object({
    meta: z
      .object({
        name: z.string().min(1).max(200).optional(),
        competition: z.string().min(1).max(200).optional(),
        seasonYear: z.number().int().min(1900).max(2100).optional(),
        sport: z.literal("football").optional(),
      })
      .optional(),

    // Comentario en español: mantenemos estos 3 arrays como base del snapshot
    teams: z.array(templateTeamSchema),
    phases: z.array(templatePhaseSchema),
    matches: z.array(templateMatchSchema),

    note: z.string().max(500).optional(),
  })
  // Comentario en español: permitimos campos extra por ahora para no bloquear evolución
  .passthrough();

export type TemplateData = z.infer<typeof templateDataSchema>;


export type TemplateDataIssue = {
  path: string;
  message: string;
};

// Comentario en español: validación “lógica” adicional (consistencia entre IDs y referencias)
export function validateTemplateDataConsistency(data: TemplateData): TemplateDataIssue[] {
  const issues: TemplateDataIssue[] = [];

  const teamIds = new Set<string>();
  for (const t of data.teams) {
    if (teamIds.has(t.id)) issues.push({ path: `teams.${t.id}`, message: `Team id duplicado: ${t.id}` });
    teamIds.add(t.id);
  }

  const phaseIds = new Set<string>();
  const phaseOrder = new Set<number>();
  for (const p of data.phases) {
    if (phaseIds.has(p.id)) issues.push({ path: `phases.${p.id}`, message: `Phase id duplicado: ${p.id}` });
    phaseIds.add(p.id);

    if (phaseOrder.has(p.order)) issues.push({ path: `phases.${p.id}.order`, message: `Phase order duplicado: ${p.order}` });
    phaseOrder.add(p.order);
  }

  const matchIds = new Set<string>();
  for (const m of data.matches) {
    if (matchIds.has(m.id)) issues.push({ path: `matches.${m.id}`, message: `Match id duplicado: ${m.id}` });
    matchIds.add(m.id);

    if (!phaseIds.has(m.phaseId)) {
      issues.push({ path: `matches.${m.id}.phaseId`, message: `phaseId no existe: ${m.phaseId}` });
    }
    if (!teamIds.has(m.homeTeamId)) {
      issues.push({ path: `matches.${m.id}.homeTeamId`, message: `homeTeamId no existe: ${m.homeTeamId}` });
    }
    if (!teamIds.has(m.awayTeamId)) {
      issues.push({ path: `matches.${m.id}.awayTeamId`, message: `awayTeamId no existe: ${m.awayTeamId}` });
    }
    if (m.homeTeamId === m.awayTeamId) {
      issues.push({ path: `matches.${m.id}`, message: `homeTeamId y awayTeamId no pueden ser iguales (${m.homeTeamId})` });
    }
  }

  return issues;
}

