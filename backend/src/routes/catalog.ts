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

// GET /catalog/instances/:instanceId/phases
// Obtiene las fases (phases) del template data de una instancia
catalogRouter.get("/instances/:instanceId/phases", async (req, res) => {
  const { instanceId } = req.params;

  const instance = await prisma.tournamentInstance.findUnique({
    where: { id: instanceId },
    select: { dataJson: true },
  });

  if (!instance) {
    return res.status(404).json({ message: "Instance not found" });
  }

  const data = instance.dataJson as any;
  const phases = data?.phases || [];

  // Retornar las fases con la estructura que necesita el frontend
  res.json({
    phases: phases.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      order: p.order,
    })),
  });
});
