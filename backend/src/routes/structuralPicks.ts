import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { writeAuditEvent } from "../lib/audit";
import { canMakePicks } from "../services/poolStateMachine";

export const structuralPicksRouter = Router();

// Todo requiere autenticación
structuralPicksRouter.use(requireAuth);

// ==================== SCHEMAS ====================

const groupStandingsPickSchema = z.object({
  groupId: z.string(),
  teamIds: z.array(z.string()).length(4), // Exactamente 4 equipos en orden
});

const knockoutWinnerPickSchema = z.object({
  matchId: z.string(),
  winnerId: z.string(),
});

const groupStandingsPhasePickSchema = z.object({
  groups: z.array(groupStandingsPickSchema),
});

const knockoutPhasePickSchema = z.object({
  matches: z.array(knockoutWinnerPickSchema),
});

const structuralPickPayloadSchema = z.union([
  groupStandingsPhasePickSchema,
  knockoutPhasePickSchema,
]);

// ==================== HELPERS ====================

async function requireActivePoolMember(userId: string, poolId: string) {
  const member = await prisma.poolMember.findFirst({
    where: { poolId, userId, status: "ACTIVE" },
  });
  return member != null;
}

// ==================== ENDPOINTS ====================

// PUT /pools/:poolId/structural-picks/:phaseId
// Guarda/actualiza todos los picks estructurales de una fase completa
structuralPicksRouter.put("/:poolId/structural-picks/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const parsed = structuralPickPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    });
  }

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { tournamentInstance: true },
  });

  if (!pool) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // Validar que el pool permita hacer picks según su estado
  if (!canMakePicks(pool.status as any)) {
    return res.status(409).json({
      error: "CONFLICT",
      message: "Cannot make picks in this pool status",
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

  // TODO: Validar deadline de la fase (si aplica)
  // Por ahora permitimos editar hasta que el host publique resultados

  // Obtener pick existente para hacer merge si es knockout
  const existingPick = await prisma.structuralPrediction.findUnique({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
  });

  // Para knockout picks, hacer merge con picks existentes
  let finalPickData = parsed.data;
  if ("matches" in parsed.data && existingPick?.pickJson) {
    const existingData = existingPick.pickJson as any;
    if (existingData.matches && Array.isArray(existingData.matches)) {
      // Crear un map de picks existentes
      const matchesMap = new Map<string, string>();
      for (const m of existingData.matches) {
        matchesMap.set(m.matchId, m.winnerId);
      }
      // Actualizar con los nuevos picks
      for (const m of parsed.data.matches) {
        matchesMap.set(m.matchId, m.winnerId);
      }
      // Convertir de vuelta a array
      finalPickData = {
        matches: Array.from(matchesMap.entries()).map(([matchId, winnerId]) => ({
          matchId,
          winnerId,
        })),
      };
    }
  }

  // Guardar en tabla StructuralPrediction (nueva tabla)
  const prediction = await prisma.structuralPrediction.upsert({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
    update: {
      pickJson: finalPickData as any,
    },
    create: {
      poolId,
      userId: req.auth!.userId,
      phaseId,
      pickJson: finalPickData as any,
    },
  });

  await writeAuditEvent({
    actorUserId: req.auth!.userId,
    action: "STRUCTURAL_PREDICTION_UPSERTED",
    entityType: "StructuralPrediction",
    entityId: prediction.id,
    dataJson: { poolId, phaseId },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  return res.json(prediction);
});

// GET /pools/:poolId/structural-picks/:phaseId
// Obtiene el pick estructural del usuario para una fase
structuralPicksRouter.get("/:poolId/structural-picks/:phaseId", async (req, res) => {
  const { poolId, phaseId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const prediction = await prisma.structuralPrediction.findUnique({
    where: {
      poolId_userId_phaseId: {
        poolId,
        userId: req.auth!.userId,
        phaseId,
      },
    },
  });

  if (!prediction) {
    return res.json({ pick: null });
  }

  return res.json({ pick: prediction.pickJson });
});

// GET /pools/:poolId/structural-picks
// Lista TODOS los picks estructurales del usuario en la pool
structuralPicksRouter.get("/:poolId/structural-picks", async (req, res) => {
  const { poolId } = req.params;

  const isMember = await requireActivePoolMember(req.auth!.userId, poolId);
  if (!isMember) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const predictions = await prisma.structuralPrediction.findMany({
    where: { poolId, userId: req.auth!.userId },
    orderBy: { createdAtUtc: "asc" },
  });

  return res.json({ picks: predictions });
});
