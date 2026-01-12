import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { canPublishResults } from "../services/poolStateMachine";

export const structuralResultsRouter = Router();

// Todo requiere autenticación
structuralResultsRouter.use(requireAuth);

// ==================== SCHEMAS ====================

const groupStandingsResultSchema = z.object({
  groupId: z.string(),
  teamIds: z.array(z.string()).length(4),
});

const knockoutWinnerResultSchema = z.object({
  matchId: z.string(),
  winnerId: z.string(),
});

const groupStandingsPhaseResultSchema = z.object({
  groups: z.array(groupStandingsResultSchema),
});

const knockoutPhaseResultSchema = z.object({
  matches: z.array(knockoutWinnerResultSchema),
});

const structuralResultPayloadSchema = z.union([
  groupStandingsPhaseResultSchema,
  knockoutPhaseResultSchema,
]);

// ==================== HELPERS ====================

async function requireHostOrCoAdmin(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: {
      poolId,
      userId,
      status: "ACTIVE",
      role: { in: ["HOST", "CO_ADMIN"] },
    },
  });
  return member != null;
}

// ==================== ENDPOINTS ====================

// PUT /pools/:poolId/structural-results/:phaseId
// Host/Co-Admin publica resultados estructurales de una fase completa
structuralResultsRouter.put("/:poolId/structural-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const parsed = structuralResultPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    });
  }

  const isHostOrCoAdmin = await requireHostOrCoAdmin(req.auth!.userId, poolId);
  if (!isHostOrCoAdmin) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Only HOST or CO_ADMIN can publish results",
    });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Validar que el pool permita publicar resultados según su estado
  if (!canPublishResults(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot publish results in this pool status",
    });
  }

  if (pool.tournamentInstance.status === "ARCHIVED") {
    return res.status(409).json({
      error: "CONFLICT",
      message: "TournamentInstance is ARCHIVED",
    });
  }

  // Validar que la fase existe en el template
  const templateData = pool.tournamentInstance.dataJson as any;
  const phases = templateData?.phases || [];
  const phase = phases.find((p: any) => p.id === phaseId);

  if (!phase) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: "Phase not found in tournament instance",
    });
  }

  // Upsert resultado estructural
  const result = await prisma.structuralPhaseResult.upsert({
    where: {
      poolId_phaseId: {
        poolId,
        phaseId,
      },
    },
    update: {
      resultJson: parsed.data as any,
      createdByUserId: req.auth!.userId,
      publishedAtUtc: new Date(),
    },
    create: {
      poolId,
      phaseId,
      resultJson: parsed.data as any,
      createdByUserId: req.auth!.userId,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "STRUCTURAL_RESULT_PUBLISHED",
    entityType: "StructuralPhaseResult",
    entityId: result.id,
    dataJson: { poolId, phaseId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(result);
});

// GET /pools/:poolId/structural-results/:phaseId
// Obtiene el resultado estructural oficial de una fase
structuralResultsRouter.get("/:poolId/structural-results/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  // Cualquier miembro activo puede ver resultados
  const isMember = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const result = await prisma.structuralPhaseResult.findUnique({
    where: {
      poolId_phaseId: {
        poolId,
        phaseId,
      },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!result) {
    return res.json({ result: null });
  }

  return res.json({ result });
});

// GET /pools/:poolId/structural-results
// Lista TODOS los resultados estructurales de la pool
structuralResultsRouter.get("/:poolId/structural-results", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await prisma.poolMember.findFirst({
    where: { poolId, userId: req.auth!.userId, status: "ACTIVE" },
  });

  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const results = await prisma.structuralPhaseResult.findMany({
    where: { poolId },
    include: {
      createdBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAtUtc: "asc" },
  });

  return res.json({ results });
});
