// Type declaration for the npm package `numero-a-letras` (no shipped
// .d.ts at the version we pinned). The library exposes a single
// function-like export under the name `NumerosALetras`.
declare module "numero-a-letras" {
  /**
   * Convert a number to Spanish words.
   *
   * Example:
   *   NumerosALetras(257000) // → "DOSCIENTOS CINCUENTA Y SIETE MIL ..."
   */
  export function NumerosALetras(amount: number, opts?: Record<string, unknown>): string;
}
