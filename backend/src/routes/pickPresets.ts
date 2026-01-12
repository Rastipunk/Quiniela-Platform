// Endpoints para presets de configuración de picks
// Sprint 2 - Advanced Pick Types System

import { Router } from "express";
import { getAllPresets, getPresetByKey } from "../lib/pickPresets";

export const pickPresetsRouter = Router();

// GET /pick-presets
// Comentario en español: obtiene todos los presets disponibles
pickPresetsRouter.get("/", async (req, res) => {
  const presets = getAllPresets();

  return res.json({
    presets: presets.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      // No incluir config completo aquí, solo metadata
    })),
  });
});

// GET /pick-presets/:key
// Comentario en español: obtiene un preset específico con su configuración completa
pickPresetsRouter.get("/:key", async (req, res) => {
  const { key } = req.params;

  const preset = getPresetByKey(key.toUpperCase());

  if (!preset) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Preset ${key} not found`,
    });
  }

  return res.json(preset);
});
