"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/**
 * Attribution capture — runs once per mount on every page, reads UTMs /
 * click IDs / referrer from the landing URL and stores them in
 * sessionStorage for the signup flow to forward to the backend.
 *
 * Rendered from the root layout so it executes no matter which page the
 * user lands on (organic search → blog, paid → pricing, invite → pool,
 * etc.). First-touch semantics live inside `captureAttribution`.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
