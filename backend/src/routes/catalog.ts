import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const catalogRouter = Router();

// Todo el catálogo requiere estar logueado
catalogRouter.use(requireAuth);

// GET /catalog/instances
catalogRouter.get("/instances", async (_req, res) => {
  const instances = await prisma.tournamentInstance.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAtUtc: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      templateId: true,
      templateVersionId: true,
      createdAtUtc: true,
      updatedAtUtc: true,
      template: {
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          currentPublishedVersionId: true,
        },
      },
    },
  });

  res.json(instances);
});
