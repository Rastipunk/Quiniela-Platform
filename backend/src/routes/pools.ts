import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { isPoolAdmin } from "../lib/roles";
import { PoolPickTypesConfigSchema } from "../validation/pickConfig";
import { validatePoolPickTypesConfig } from "../validation/pickConfig";
import { getPresetByKey, generateDynamicPresetConfig } from "../lib/pickPresets";
import { extractPhases } from "../lib/fixture";

// Sub-routers
import { poolOverviewRouter } from "./poolOverview";
import { poolMembersRouter } from "./poolMembers";
import { poolInvitesRouter } from "./poolInvites";
import { poolAdminRouter } from "./poolAdmin";

export const poolsRouter = Router();
poolsRouter.use(requireAuth);

// Mount sub-routers
poolsRouter.use("/", poolOverviewRouter);
poolsRouter.use("/", poolMembersRouter);
poolsRouter.use("/", poolInvitesRouter);
poolsRouter.use("/", poolAdminRouter);

const createPoolSchema = z.object({
  tournamentInstanceId: z.string().min(1),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  timeZone: z.string().min(3).max(64).optional(), // Comentario en español: IANA TZ
  deadlineMinutesBeforeKickoff: z.number().int().min(0).max(1440).optional(),
  scoringPresetKey: z.enum(["CLASSIC", "OUTCOME_ONLY", "EXACT_HEAVY"]).optional(),
  requireApproval: z.boolean().optional(),
  maxParticipants: z.number().int().min(20).max(10000).optional(),

  // Comentario en español: configuración de tipos de picks
  // Puede ser: preset key ("BASIC", "SIMPLE", "CUMULATIVE") o configuración custom
  pickTypesConfig: z.union([
    z.enum(["BASIC", "SIMPLE", "CUMULATIVE"]), // Preset key
    PoolPickTypesConfigSchema, // Configuración custom
  ]).optional(),
});

// POST /pools  (crea pool y agrega al creador como HOST)
poolsRouter.post("/", async (req, res) => {
  const parsed = createPoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  }

  const {
    tournamentInstanceId,
    name,
    description,
    timeZone,
    deadlineMinutesBeforeKickoff,
    scoringPresetKey,
    requireApproval,
    maxParticipants,
    pickTypesConfig
  } = parsed.data;

  const instance = await prisma.tournamentInstance.findUnique({ where: { id: tournamentInstanceId } });
  if (!instance) return res.status(404).json({ error: "NOT_FOUND", message: "TournamentInstance not found" });

  // Comentario en español: no permitimos pools sobre instancias archivadas
  if (instance.status === "ARCHIVED") {
    return res.status(409).json({ error: "CONFLICT", message: "Cannot create pool on ARCHIVED instance" });
  }

  // Comentario en español: procesar pickTypesConfig
  let finalPickTypesConfig: any = null;

  if (pickTypesConfig) {
    // Si es un string, es un preset key — generar config dinámica con fases reales
    if (typeof pickTypesConfig === "string") {
      // Extraer fases del dataJson de la instancia
      const instancePhases = extractPhases(instance.dataJson);

      let dynamicConfig = instancePhases.length > 0
        ? generateDynamicPresetConfig(pickTypesConfig, instancePhases)
        : null;

      // Fallback a preset hardcoded si no hay fases en la instancia
      if (!dynamicConfig) {
        const preset = getPresetByKey(pickTypesConfig);
        if (!preset) {
          return res.status(400).json({
            error: "VALIDATION_ERROR",
            message: `Invalid preset key: ${pickTypesConfig}`
          });
        }
        dynamicConfig = preset.config;
      }
      finalPickTypesConfig = dynamicConfig;
    } else {
      // Es una configuración custom, validar
      const validation = validatePoolPickTypesConfig(pickTypesConfig);

      if (!validation.valid) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Invalid pick types configuration",
          errors: validation.errors,
        });
      }

      // Si hay warnings, incluirlos en la respuesta pero no bloquear
      if (validation.warnings.length > 0) {
        // Los warnings se retornan al frontend para que el usuario decida
        // Por ahora, los guardamos en audit log
        await writeAuditEvent({
          actorUserId: req.auth!.userId,
          action: "POOL_CONFIG_WARNINGS",
          entityType: "Pool",
          entityId: "pending",
          dataJson: { warnings: validation.warnings },
          ip: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        });
      }

      finalPickTypesConfig = pickTypesConfig;
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const pool = await tx.pool.create({
      data: {
        tournamentInstanceId,
        name,
        description: description ?? null,
        visibility: "PRIVATE",
        timeZone: timeZone ?? "UTC",
        deadlineMinutesBeforeKickoff: deadlineMinutesBeforeKickoff ?? 10,
        createdByUserId: req.auth!.userId,
        scoringPresetKey: scoringPresetKey ?? "CLASSIC",
        requireApproval: requireApproval ?? false,
        maxParticipants: maxParticipants ?? 20,
        pickTypesConfig: finalPickTypesConfig,
        // CRÍTICO: Copiar el fixture del torneo para que cada pool tenga su propia copia
        fixtureSnapshot: instance.dataJson as Prisma.InputJsonValue,
      },
    });

    await tx.poolMember.create({
      data: {
        poolId: pool.id,
        userId: req.auth!.userId,
        role: "HOST",
        status: "ACTIVE",
      },
    });

    return pool;
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "POOL_CREATED",
    entityType: "Pool",
    entityId: created.id,
    dataJson: {
      tournamentInstanceId,
      hasPickTypesConfig: !!finalPickTypesConfig,
    },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.status(201).json(created);
});


// GET /pools/:poolId
// Comentario en español: detalle del pool + mi membership + counts (para pantalla pool)
poolsRouter.get("/:poolId", async (req, res) => {
  const { poolId } = req.params;

  // Comentario en español: hay que ser miembro ACTIVO para ver el pool
  const myMembership = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!myMembership) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const membersActive = await prisma.poolMember.count({
    where: { poolId, status: "ACTIVE" },
  });

  return res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      status: pool.status,
      timeZone: pool.timeZone,
      deadlineMinutesBeforeKickoff: pool.deadlineMinutesBeforeKickoff,
      tournamentInstanceId: pool.tournamentInstanceId,
      createdByUserId: pool.createdByUserId,
      createdAtUtc: pool.createdAtUtc,
      updatedAtUtc: pool.updatedAtUtc,
      scoringPresetKey: pool.scoringPresetKey,
      autoAdvanceEnabled: pool.autoAdvanceEnabled,
      requireApproval: pool.requireApproval,
    },
    myMembership: {
      role: myMembership.role,
      status: myMembership.status,
      joinedAtUtc: myMembership.joinedAtUtc,
    },
    counts: {
      membersActive,
    },
    tournamentInstance: pool.tournamentInstance
      ? {
          id: pool.tournamentInstance.id,
          name: pool.tournamentInstance.name,
          status: pool.tournamentInstance.status,
          templateId: pool.tournamentInstance.templateId,
          templateVersionId: pool.tournamentInstance.templateVersionId,
        }
      : null,
    permissions: {
      canManageResults: isPoolAdmin(myMembership.role),
      canInvite: isPoolAdmin(myMembership.role),
    },
  });
});
