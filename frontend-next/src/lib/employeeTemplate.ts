/**
 * Employee Invite Excel Template
 *
 * Generates a branded .xlsx template for corporate hosts to fill in
 * employee emails, and parses uploaded .xlsx files to extract emails.
 * Shares branding style with the leaderboard export.
 */

import ExcelJS from "exceljs";
import { BRAND } from "@/lib/brand";

// ── Brand color helpers ────────────────────────────────────────

function hexToArgb(hex: string): string {
  return "FF" + hex.replace("#", "");
}

const COLORS = {
  brandPrimary: hexToArgb(BRAND.primary),
  brandDark: hexToArgb(BRAND.primaryDark),
  brandLight: hexToArgb("#E8E6FD"),
  white: hexToArgb("#FFFFFF"),
  textDark: hexToArgb(BRAND.text),
  textMuted: hexToArgb(BRAND.textMuted),
  borderLight: hexToArgb("#E5E7EB"),
  infoBg: hexToArgb("#EFF6FF"),
  infoBorder: hexToArgb("#BFDBFE"),
  infoText: hexToArgb("#1E40AF"),
  exampleText: hexToArgb("#9CA3AF"),
};

// ── Logo fetch ─────────────────────────────────────────────────

async function fetchLogoAsBase64(): Promise<string | null> {
  try {
    const res = await fetch("/brand/logotipo-degradado-120.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Generate branded template ──────────────────────────────────

export async function downloadEmployeeTemplate(companyName?: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Picks4All";
  wb.created = new Date();

  const ws = wb.addWorksheet("Empleados", {
    properties: { defaultColWidth: 40 },
    views: [{ state: "frozen", ySplit: 7, xSplit: 0 }],
  });

  // ── 1. Logo ──────────────────────────────────────────────────

  const logoBase64 = await fetchLogoAsBase64();
  if (logoBase64) {
    const logoId = wb.addImage({ base64: logoBase64, extension: "png" });
    ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 45 },
    });
  }

  ws.getRow(1).height = 40;
  ws.mergeCells(1, 1, 1, 2);

  // ── 2. Title ─────────────────────────────────────────────────

  const titleRow = ws.getRow(2);
  ws.mergeCells(2, 1, 2, 2);
  const titleCell = titleRow.getCell(1);
  titleCell.value = companyName
    ? `Invitaciones — ${companyName}`
    : "Invitaciones de Empleados";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLORS.brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 30;

  // ── 3. Instructions ──────────────────────────────────────────

  const instrRow = ws.getRow(3);
  ws.mergeCells(3, 1, 3, 2);
  const instrCell = instrRow.getCell(1);
  instrCell.value = "Escribe un email por fila en la columna A. Luego sube este archivo en el wizard.";
  instrCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: COLORS.textMuted } };
  instrCell.alignment = { horizontal: "center", vertical: "middle" };
  instrRow.height = 22;

  // ── 4. Tips box ──────────────────────────────────────────────

  const tipRow = ws.getRow(4);
  ws.mergeCells(4, 1, 4, 2);
  const tipCell = tipRow.getCell(1);
  tipCell.value = "No modifiques la fila de encabezado (fila 7). Agrega un email por fila.";
  tipCell.font = { name: "Calibri", size: 10, color: { argb: COLORS.infoText } };
  tipCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.infoBg } };
  tipCell.alignment = { horizontal: "center", vertical: "middle" };
  tipCell.border = {
    top: { style: "thin", color: { argb: COLORS.infoBorder } },
    bottom: { style: "thin", color: { argb: COLORS.infoBorder } },
  };
  tipRow.height = 24;

  // ── 5-6. Spacer ──────────────────────────────────────────────

  ws.getRow(5).height = 6;
  ws.getRow(6).height = 6;

  // ── 7. Header row ────────────────────────────────────────────

  const headerRow = ws.getRow(7);
  headerRow.values = ["Email", "Nombre (opcional)"];
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandPrimary } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: COLORS.brandDark } },
    };
  });

  // ── 8-10. Example rows (light gray, italic) ─────────────────

  const examples = [
    ["maria.garcia@empresa.com", "María García"],
    ["juan.perez@empresa.com", "Juan Pérez"],
    ["carlos.lopez@empresa.com", ""],
  ];

  examples.forEach((ex, idx) => {
    const row = ws.getRow(8 + idx);
    row.values = ex;
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, italic: true, color: { argb: COLORS.exampleText } };
      cell.border = {
        bottom: { style: "thin", color: { argb: COLORS.borderLight } },
      };
    });
  });

  // Clear example values (they're just visual guides — user overwrites them)
  // Actually keep them as real examples so the user understands the format

  // ── Column widths ────────────────────────────────────────────

  ws.getColumn(1).width = 40; // Email
  ws.getColumn(2).width = 30; // Name

  // ── Data validation on email column (rows 8-507) ─────────────

  // Add empty rows with light border to guide the user
  for (let i = 11; i <= 57; i++) {
    const row = ws.getRow(i);
    row.height = 22;
    row.getCell(1).border = {
      bottom: { style: "thin", color: { argb: COLORS.borderLight } },
    };
    row.getCell(2).border = {
      bottom: { style: "thin", color: { argb: COLORS.borderLight } },
    };
  }

  // ── Generate and download ────────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const safeName = (companyName ?? "empresa")
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const filename = `Plantilla_Empleados_${safeName}.xlsx`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Parse uploaded Excel ───────────────────────────────────────

export async function parseEmployeeExcel(file: File): Promise<{
  emails: string[];
  errors: string[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(1);
  if (!ws) return { emails: [], errors: ["No worksheet found in the file."] };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  // Start reading from row 8 (after the branded header)
  // But also try from row 2 in case user uploaded a plain file
  const startRow = ws.rowCount >= 7 ? 8 : 2;

  ws.eachRow((row, rowNum) => {
    if (rowNum < startRow) return;

    const cellValue = row.getCell(1).text?.trim();
    if (!cellValue) return;

    // Skip cells that are clearly not emails (footer text, merged cells, long strings)
    if (cellValue.includes(" — ") || cellValue.includes("picks4all") || cellValue.length > 100) return;

    const email = cellValue.toLowerCase();

    // Skip example rows from the template
    if (email.includes("@empresa.com") || email.includes("@company.com")) return;

    if (!emailRegex.test(email)) {
      errors.push(`Fila ${rowNum}: "${cellValue}" no es un email válido.`);
      return;
    }

    if (seen.has(email)) return; // dedupe
    seen.add(email);
    emails.push(email);
  });

  return { emails, errors };
}
