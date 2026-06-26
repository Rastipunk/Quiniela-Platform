/**
 * Branded PDF table exporter (lazy-loaded — import this module
 * dynamically so jsPDF + fonts never weigh on the initial bundle).
 *
 * Produces the share-in-the-group-chat artifact: Picks4All header with
 * logo, pool title, a compact table and a branded footer with page
 * numbers. Embeds Roboto (fetched from /fonts) so every player name
 * renders — jsPDF's built-in fonts are Latin-1 only and would garble
 * names like "Małgorzata".
 *
 * Used by:
 *  - Leaderboard PDF (PoolLeaderboardTab) — full standings, per-phase.
 *  - Match picks PDF (MatchPicksModal) — everyone's prediction for one
 *    match, ordered by leaderboard position.
 */

import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { BRAND } from "@/lib/brand";
import { fetchLogoAsBase64 } from "@/lib/exportLeaderboard";

// ── Layout constants (pt, A4 portrait: 595 × 842) ──────────────
const PAGE_MARGIN = 40;
const HEADER_LOGO_WIDTH = 90;
const HEADER_LOGO_HEIGHT = 25;
/** Podium row fills — same palette as the Excel export. */
const ROW_FILLS: [number, number, number][] = [
  [254, 243, 199], // gold
  [243, 244, 246], // silver
  [255, 247, 237], // bronze
];
const ZEBRA_FILL: [number, number, number] = [250, 250, 255];
const TOTAL_COL_FILL: [number, number, number] = [238, 242, 255];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function fetchFontAsBase64(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface BrandedPdfSpec {
  /** Document type line under the pool name (e.g. "Tabla de posiciones"). */
  docTitle: string;
  poolName: string;
  /** Optional extra context lines under the title (tournament, match, result, date). */
  subtitleLines: string[];
  head: string[];
  body: RowInput[];
  /** Column index to highlight as the "Total" column (null = none). */
  totalColIndex: number | null;
  /** Columns boxed with the Total fill + green/red by sign (e.g. last-match
   *  "Puntos / Posiciones"). Cells starting with + or ↑ are green, − or ↓ red. */
  deltaColIndices?: number[];
  /** Paint podium fills on the first three body rows (leaderboard order). */
  podiumRows: boolean;
  /** Optional footnote printed after the table (e.g. random-pick legend). */
  footnote?: string;
  /** Footer center text (player/match counts). Domain is added automatically. */
  footerText: string;
  filenameBase: string;
}

/** Mirrors the Excel exporter's filename sanitizer. */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").trim().replace(/\s+/g, "_");
}

export async function generateBrandedTablePdf(spec: BrandedPdfSpec): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Unicode font (player names beyond Latin-1). Fall back to helvetica
  // if the asset is unreachable — a slightly garbled name beats no PDF.
  const [regular, bold] = await Promise.all([
    fetchFontAsBase64("/fonts/Roboto-Regular.ttf"),
    fetchFontAsBase64("/fonts/Roboto-Bold.ttf"),
  ]);
  let fontFamily = "helvetica";
  if (regular && bold) {
    doc.addFileToVFS("Roboto-Regular.ttf", regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    fontFamily = "Roboto";
  }

  const brandPrimary = hexToRgb(BRAND.primary);
  const brandDark = hexToRgb(BRAND.primaryDark);
  const textMuted = hexToRgb(BRAND.textMuted);

  // ── Header block (first page) ────────────────────────────────
  const logo = await fetchLogoAsBase64();
  let cursorY = PAGE_MARGIN;
  if (logo) {
    doc.addImage(logo, "PNG", PAGE_MARGIN, cursorY, HEADER_LOGO_WIDTH, HEADER_LOGO_HEIGHT);
  }
  cursorY += HEADER_LOGO_HEIGHT + 16;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...brandDark);
  doc.text(spec.poolName, PAGE_MARGIN, cursorY);
  cursorY += 18;

  doc.setFontSize(11);
  doc.setTextColor(...brandPrimary);
  doc.text(spec.docTitle, PAGE_MARGIN, cursorY);
  cursorY += 14;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  for (const line of spec.subtitleLines) {
    doc.text(line, PAGE_MARGIN, cursorY);
    cursorY += 12;
  }
  cursorY += 4;

  // ── Table ────────────────────────────────────────────────────
  autoTable(doc, {
    startY: cursorY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_MARGIN },
    head: [spec.head],
    body: spec.body,
    styles: { font: fontFamily, fontSize: 8, cellPadding: 4, textColor: hexToRgb(BRAND.text) },
    headStyles: { fillColor: brandPrimary, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: { 1: { halign: "left" } }, // player column left-aligned
    didParseCell: (data) => {
      if (data.section !== "body") {
        if (
          data.section === "head" &&
          (data.column.index === spec.totalColIndex ||
            spec.deltaColIndices?.includes(data.column.index))
        ) {
          // Box the Total + delta headers together with the brand-dark fill.
          data.cell.styles.fillColor = brandDark;
        }
        return;
      }
      if (data.column.index !== 1) data.cell.styles.halign = "center";
      // Total column highlight wins over row fills (Excel parity).
      if (data.column.index === spec.totalColIndex) {
        data.cell.styles.fillColor = TOTAL_COL_FILL;
        data.cell.styles.textColor = brandPrimary;
        data.cell.styles.fontStyle = "bold";
        return;
      }
      // Last-match delta columns: same box fill as Total, green/red by sign.
      if (spec.deltaColIndices?.includes(data.column.index)) {
        data.cell.styles.fillColor = TOTAL_COL_FILL;
        data.cell.styles.fontStyle = "bold";
        const raw = String(data.cell.raw ?? "");
        if (raw.startsWith("+") || raw.startsWith("↑")) data.cell.styles.textColor = [22, 163, 74];
        else if (raw.startsWith("-") || raw.startsWith("↓")) data.cell.styles.textColor = [220, 38, 38];
        else data.cell.styles.textColor = textMuted;
        return;
      }
      if (spec.podiumRows && data.row.index < ROW_FILLS.length) {
        data.cell.styles.fillColor = ROW_FILLS[data.row.index];
      } else if (data.row.index % 2 === 1) {
        data.cell.styles.fillColor = ZEBRA_FILL;
      }
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text(`${BRAND.domain} · ${spec.footerText}`, pageWidth / 2, pageHeight - 20, { align: "center" });
      doc.text(String(doc.getNumberOfPages()), pageWidth - PAGE_MARGIN, pageHeight - 20, { align: "right" });
    },
  });

  if (spec.footnote) {
    const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(spec.footnote, PAGE_MARGIN, tableEnd + 14);
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${safeFilename(spec.filenameBase)}_${date}.pdf`);
}
