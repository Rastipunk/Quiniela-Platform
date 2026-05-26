/**
 * Entry point: render an AccountReceivable row to a PDF Buffer.
 *
 * Same shape as renderQuotePdf — see SALES_AUDIT.md §9.6 for the
 * route that streams this back to the admin.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { AccountReceivable } from "@prisma/client";
import { ensureInterRegistered } from "./pdfFont";
import { CcDocument } from "./CcDocument";

export async function renderCcPdf(cc: AccountReceivable): Promise<Buffer> {
  ensureInterRegistered();
  return renderToBuffer(<CcDocument cc={cc} />);
}
