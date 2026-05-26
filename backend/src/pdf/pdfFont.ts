/**
 * Idempotent registration of the Inter typeface used by every PDF.
 *
 * @react-pdf/renderer keeps a global font registry; calling
 * `Font.register` twice with the same family is fine but wastes work.
 * The `registered` guard makes the call safe to invoke at the top of
 * every render entry point.
 *
 * The hyphenation override disables react-pdf's default word-break,
 * which would otherwise insert hyphens mid-word in business copy.
 */

import { Font } from "@react-pdf/renderer";
import { fontAsset } from "./pdfAssets";

let registered = false;

export function ensureInterRegistered(): void {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: fontAsset("Inter-Regular.ttf"), fontWeight: 400 },
      { src: fontAsset("Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: fontAsset("Inter-Bold.ttf"), fontWeight: 700 },
      { src: fontAsset("Inter-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
