/**
 * Buffer loader for brand assets used by @react-pdf/renderer.
 *
 * @react-pdf/renderer's Image component accepts a Buffer directly,
 * sidestepping the path-vs-URL resolution issues we hit during dummy
 * generation (verified: see SALES_AUDIT.md §11.12 and the v3 dummy
 * iteration that failed with "Only HTTP(S) protocols are supported"
 * before we switched to Buffer).
 *
 * Cached per process: assets are tiny (PNG 500px iso ~ 60 KB) and
 * stable, so loading once at startup is the right trade-off.
 */

import fs from "node:fs";
import path from "node:path";

const ASSETS_ROOT = path.join(__dirname, "..", "assets", "brand");
const FONTS_ROOT = path.join(__dirname, "..", "assets", "fonts");

const cache: Map<string, Buffer> = new Map();

function load(filename: string, root: string): Buffer {
  const key = path.join(root, filename);
  let buf = cache.get(key);
  if (!buf) {
    buf = fs.readFileSync(key);
    cache.set(key, buf);
  }
  return buf;
}

export const brandAsset = (filename: string): Buffer => load(filename, ASSETS_ROOT);
export const fontAsset = (filename: string): string => path.join(FONTS_ROOT, filename);
