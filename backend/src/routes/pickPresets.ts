// Endpoints para presets de configuración de picks
// Sprint 2 - Advanced Pick Types System

import { Router } from "express";
import { getAllPresets, getPresetByKey } from "../lib/pickPresets";
import { sendData, sendNotFound } from "../lib/apiResponse";

export const pickPresetsRouter = Router();

// GET /pick-presets
// Comentario en español: obtiene todos los presets disponibles
pickPresetsRouter.get("/", async (req, res) => {
  const presets = getAllPresets();

  return sendData(res, {
    presets: presets.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
    })),
  });
});

// GET /pick-presets/:key
// Comentario en español: obtiene un preset específico con su configuración completa
pickPresetsRouter.get("/:key", async (req, res) => {
  const { key } = req.params;

  const preset = getPresetByKey(key.toUpperCase());

  if (!preset) {
    return sendNotFound(res, `Preset ${key} not found`);
  }

  return sendData(res, preset as unknown as Record<string, unknown>);
});
