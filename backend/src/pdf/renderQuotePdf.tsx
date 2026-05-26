/**
 * Entry point: render a Quote row to a PDF Buffer.
 *
 * Usage from a route handler:
 *
 *   const quote = await getQuote(id);
 *   const buf = await renderQuotePdf(quote);
 *   res.setHeader("Content-Type", "application/pdf");
 *   res.setHeader("Content-Disposition", `attachment; filename="${quote.consecutive}.pdf"`);
 *   res.send(buf);
 *
 * Side-effectfully registers the Inter font on first call.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Quote } from "@prisma/client";
import { ensureInterRegistered } from "./pdfFont";
import { QuoteDocument } from "./QuoteDocument";

export async function renderQuotePdf(quote: Quote): Promise<Buffer> {
  ensureInterRegistered();
  return renderToBuffer(<QuoteDocument quote={quote} />);
}
