import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const meRouter = Router();

// Comentario en español: este router es para endpoints “mi cuenta”
meRouter.use(requireAuth);

// GET /me/pools
// Comentario en español: lista pools donde el usuario es miembro ACTIVO o PENDING_APPROVAL (para dashboard)
meRouter.get("/pools", async (req, res) => {
  const userId = req.auth!.userId;

  const memberships = await prisma.poolMember.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] as any }
    },
    orderBy: { joinedAtUtc: "desc" },
    include: {
      pool: {
        include: {
          tournamentInstance: true,
        },
      },
    },
  });

  return res.json(
    memberships.map((m) => ({
      poolId: m.poolId,
      role: m.role,
      status: m.status,
      joinedAtUtc: m.joinedAtUtc,
      pool: {
        id: m.pool.id,
        name: m.pool.name,
        description: m.pool.description,
        visibility: m.pool.visibility,
        status: m.pool.status,
        timeZone: m.pool.timeZone,
        deadlineMinutesBeforeKickoff: m.pool.deadlineMinutesBeforeKickoff,
        tournamentInstanceId: m.pool.tournamentInstanceId,
        createdAtUtc: m.pool.createdAtUtc,
        updatedAtUtc: m.pool.updatedAtUtc,
        scoringPresetKey: m.pool.scoringPresetKey ?? "CLASSIC",

      },
      tournamentInstance: m.pool.tournamentInstance
        ? {
            id: m.pool.tournamentInstance.id,
            name: m.pool.tournamentInstance.name,
            status: m.pool.tournamentInstance.status,
            templateId: m.pool.tournamentInstance.templateId,
            templateVersionId: m.pool.tournamentInstance.templateVersionId,
            createdAtUtc: m.pool.tournamentInstance.createdAtUtc,
            updatedAtUtc: m.pool.tournamentInstance.updatedAtUtc,
          }
        : null,
    }))
  );
});
