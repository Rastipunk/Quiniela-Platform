import crypto from "crypto";
import { CRYPTO_BYTES } from "./constants";

export function outcomeFromScore(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

export function makeInviteCode() {
  // Comentario en español: código corto, suficientemente único para MVP
  return crypto.randomBytes(CRYPTO_BYTES.POOL_INVITE_CODE).toString("hex"); // 12 chars
}
