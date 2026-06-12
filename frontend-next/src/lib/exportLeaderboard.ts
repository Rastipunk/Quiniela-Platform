/**
 * Leaderboard Excel Export
 *
 * Generates a branded .xlsx file with the leaderboard table,
 * including per-phase point breakdowns, brand colors, and the
 * Picks4All logo in the header.
 */

import ExcelJS from "exceljs";
import type { PoolOverview } from "@/lib/poolTypes";
import { BRAND } from "@/lib/brand";

// ── Brand color helpers ────────────────────────────────────────

/** Convert hex to ExcelJS ARGB (without #, prefixed with FF for full opacity) */
function hexToArgb(hex: string): string {
  return "FF" + hex.replace("#", "");
}

const COLORS = {
  brandPrimary: hexToArgb(BRAND.primary),       // 4f46e5
  brandDark: hexToArgb(BRAND.primaryDark),       // 312e81
  brandLight: hexToArgb("#E8E6FD"),              // light brand bg
  white: hexToArgb("#FFFFFF"),
  textDark: hexToArgb(BRAND.text),               // 1F2937
  textMuted: hexToArgb(BRAND.textMuted),         // 6B7280
  gold: hexToArgb("#FEF3C7"),                    // 1st place row
  silver: hexToArgb("#F3F4F6"),                  // 2nd place row
  bronze: hexToArgb("#FFF7ED"),                  // 3rd place row
  zebraLight: hexToArgb("#FAFAFF"),              // alternating row
  borderLight: hexToArgb("#E5E7EB"),
  totalColBg: hexToArgb("#EEF2FF"),              // total column highlight
};

const MEDALS = ["🥇", "🥈", "🥉"];

// ── Phase name formatter (standalone, no i18n dependency) ──────

const PHASE_LABELS: Record<string, string> = {
  group_stage: "Fase de Grupos",
  round_of_32: "16avos",
  round_of_16: "Octavos",
  quarter_finals: "Cuartos",
  quarterfinals: "Cuartos",
  semi_finals: "Semis",
  semifinals: "Semis",
  third_place: "3er Lugar",
  finals: "Final",
  final: "Final",
  r32_leg1: "16avos Ida",
  r32_leg2: "16avos Vuelta",
  r16_leg1: "8vos Ida",
  r16_leg2: "8vos Vuelta",
  qf_leg1: "4tos Ida",
  qf_leg2: "4tos Vuelta",
  sf_leg1: "Semis Ida",
  sf_leg2: "Semis Vuelta",
  final_leg1: "Final Ida",
  final_leg2: "Final Vuelta",
};

export function phaseLabel(phaseId: string): string {
  return PHASE_LABELS[phaseId] ?? phaseId.replace(/_/g, " ");
}

// ── Logo fetch helper (shared with the PDF exporter) ───────────

export async function fetchLogoAsBase64(): Promise<string | null> {
  try {
    const res = await fetch("/brand/logotipo-degradado-120.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the data:image/png;base64, prefix
        resolve(result.split(",")[1] ?? null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Main export function ───────────────────────────────────────

export async function exportLeaderboardExcel(
  overview: PoolOverview,
  phaseNameFormatter?: (phaseId: string) => string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Picks4All";
  wb.created = new Date();

  const ws = wb.addWorksheet("Posiciones", {
    properties: { defaultColWidth: 14 },
    views: [{ state: "frozen", ySplit: 6, xSplit: 0 }], // Freeze header rows
  });

  const { leaderboard, pool } = overview;
  const phases = leaderboard.phases ?? [];
  const rows = leaderboard.rows;
  const leaderPoints = rows[0]?.points ?? 0;

  // Total columns: Pos | Jugador | Total | ...phases | Dif
  const totalCols = 3 + phases.length + 1;

  // ── 1. Logo row ──────────────────────────────────────────────

  const logoBase64 = await fetchLogoAsBase64();
  if (logoBase64) {
    const logoId = wb.addImage({
      base64: logoBase64,
      extension: "png",
    });
    ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 45 },
    });
  }

  // Row 1: logo space
  ws.getRow(1).height = 40;
  ws.mergeCells(1, 1, 1, totalCols);

  // ── 2. Title row ─────────────────────────────────────────────

  const titleRow = ws.getRow(2);
  ws.mergeCells(2, 1, 2, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.value = pool.name;
  titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: COLORS.brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 32;

  // ── 3. Subtitle row (tournament + date) ──────────────────────

  const subtitleRow = ws.getRow(3);
  ws.mergeCells(3, 1, 3, totalCols);
  const subtitleCell = subtitleRow.getCell(1);
  const now = new Date();
  const dateStr = now.toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });
  const tournamentName = overview.tournamentInstance?.name ?? "";
  subtitleCell.value = tournamentName ? `${tournamentName} · Exportado: ${dateStr}` : `Exportado: ${dateStr}`;
  subtitleCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: COLORS.textMuted } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  subtitleRow.height = 22;

  // ── 4. Scoring info row ──────────────────────────────────────

  const scoringRow = ws.getRow(4);
  ws.mergeCells(4, 1, 4, totalCols);
  const scoringCell = scoringRow.getCell(1);
  const { outcomePoints, exactScoreBonus } = leaderboard.scoring;
  scoringCell.value = `Puntuación: ${outcomePoints} pts por resultado · ${exactScoreBonus} pts bonus por marcador exacto`;
  scoringCell.font = { name: "Calibri", size: 10, color: { argb: COLORS.textMuted } };
  scoringCell.alignment = { horizontal: "center", vertical: "middle" };
  scoringRow.height = 20;

  // ── 5. Spacer row ────────────────────────────────────────────

  ws.getRow(5).height = 8;

  // ── 6. Header row ────────────────────────────────────────────

  const headerValues: string[] = ["#", "Jugador", "Total"];
  phases.forEach((p) => headerValues.push(phaseNameFormatter ? phaseNameFormatter(p) : phaseLabel(p)));
  headerValues.push("Dif");

  const headerRow = ws.getRow(6);
  headerRow.values = headerValues;
  headerRow.height = 28;

  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandPrimary } };
    cell.alignment = { horizontal: colNum === 2 ? "left" : "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: COLORS.brandDark } },
    };
  });

  // Special style for "Total" header
  const totalHeaderCell = headerRow.getCell(3);
  totalHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandDark } };

  // ── 7. Data rows ─────────────────────────────────────────────

  rows.forEach((r, idx) => {
    const diff = leaderPoints - r.points;
    const medal = MEDALS[idx] ?? "";
    const rankDisplay = medal ? `${medal} ${r.rank}` : String(r.rank);

    const values: (string | number)[] = [rankDisplay, r.displayName, r.points];
    phases.forEach((p) => values.push(r.pointsByPhase?.[p] ?? 0));
    values.push(idx === 0 ? "-" : `-${diff}`);

    const dataRow = ws.getRow(7 + idx);
    dataRow.values = values;
    dataRow.height = 24;

    // Row background
    let rowBg: string | null = null;
    if (idx === 0) rowBg = COLORS.gold;
    else if (idx === 1) rowBg = COLORS.silver;
    else if (idx === 2) rowBg = COLORS.bronze;
    else if (idx % 2 === 1) rowBg = COLORS.zebraLight;

    dataRow.eachCell((cell, colNum) => {
      // Font
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: colNum === 1 || colNum === 3, // rank and total bold
        color: { argb: colNum === 3 ? COLORS.brandPrimary : COLORS.textDark },
      };

      // Alignment
      cell.alignment = { horizontal: colNum === 2 ? "left" : "center", vertical: "middle" };

      // Background
      if (colNum === 3) {
        // Total column always has highlight
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalColBg } };
      } else if (rowBg) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      }

      // Bottom border
      cell.border = {
        bottom: { style: "thin", color: { argb: COLORS.borderLight } },
      };
    });

    // Phase cells with 0 points get muted color
    for (let p = 0; p < phases.length; p++) {
      const phaseCell = dataRow.getCell(4 + p);
      const val = r.pointsByPhase?.[phases[p]!] ?? 0;
      if (val === 0) {
        phaseCell.value = "-";
        phaseCell.font = { ...phaseCell.font, color: { argb: hexToArgb("#D1D5DB") } };
      }
    }
  });

  // ── 8. Footer row ────────────────────────────────────────────

  const footerRowIdx = 7 + rows.length + 1;
  const footerRow = ws.getRow(footerRowIdx);
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, totalCols);
  const footerCell = footerRow.getCell(1);
  footerCell.value = `picks4all.com · ${rows.length} jugadores · ${overview.matches.length} partidos`;
  footerCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: COLORS.textMuted } };
  footerCell.alignment = { horizontal: "center", vertical: "middle" };

  // ── 9. Column widths ─────────────────────────────────────────

  ws.getColumn(1).width = 8;   // # (rank)
  ws.getColumn(2).width = 24;  // Jugador
  ws.getColumn(3).width = 10;  // Total
  for (let i = 0; i < phases.length; i++) {
    ws.getColumn(4 + i).width = 12;
  }
  ws.getColumn(4 + phases.length).width = 8; // Dif

  // ── 10. Generate and download ────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);

  const safeName = pool.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").trim().replace(/\s+/g, "_");
  const filename = `Posiciones_${safeName}_${now.toISOString().slice(0, 10)}.xlsx`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
