/**
 * Sales-document issuer constant.
 *
 * Identity values that appear on every Cotización + Cuenta de Cobro
 * emitted by the platform. Locked decision §11.4 in SALES_AUDIT.md:
 * Juan Camilo Chacón Alvarado, persona natural, régimen simplificado.
 *
 * NOT in env vars — these are personal/legal identity values, version-
 * controlled with the code so changes are reviewed and auditable.
 *
 * When this constant changes, previously-issued documents are NOT
 * retroactively updated: every Quote/AccountReceivable row carries an
 * `issuerSnapshotJson` copy of the values at issue time (legal audit
 * trail). The PDF renderer reads from the snapshot, not from this
 * constant. See SALES_AUDIT.md §8 for the rationale.
 */

export interface IssuerInfo {
  legalName: string;
  documentType: string; // "CC" (cédula de ciudadanía Colombia)
  documentNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  bank: {
    name: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
  };
  taxRegime: string;
}

export const ISSUER_INFO: IssuerInfo = {
  legalName: "Juan Camilo Chacón Alvarado",
  documentType: "CC",
  documentNumber: "1016094585",
  address: "Carrera 18 # 123-60",
  city: "Bogotá D.C.",
  country: "Colombia",
  phone: "316 233 7373",
  email: "empresas@picks4all.com",
  bank: {
    name: "Bancolombia",
    accountType: "Ahorros",
    accountNumber: "18651313496",
    accountHolder: "Juan Camilo Chacón Alvarado",
  },
  taxRegime: "Régimen Simplificado — No responsable de IVA — No obligado a facturar",
};

/**
 * Snapshot helper. Returns a plain JSON object suitable for storage
 * in the `issuerSnapshotJson` column. Use this at issue time, never
 * read directly from `ISSUER_INFO` when rendering a previously-issued
 * document.
 */
export function snapshotIssuer(): IssuerInfo {
  return JSON.parse(JSON.stringify(ISSUER_INFO));
}
