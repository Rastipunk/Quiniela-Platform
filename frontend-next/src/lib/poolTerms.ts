/**
 * Regional pool terminology system.
 *
 * Maps the user's detected country (via Cloudflare CF-IPCountry header)
 * to the locally-preferred word for "pool" (quiniela, polla, prode, penca, porra)
 * along with all grammatical variants needed for natural Spanish copy.
 *
 * English and Portuguese have a single term each, so the variant object
 * is simpler for those locales.
 */

// ---------------------------------------------------------------------------
// Region identifiers
// ---------------------------------------------------------------------------

export const POOL_REGIONS = [
  "quiniela",
  "polla",
  "prode",
  "penca",
  "porra",
] as const;

export type PoolRegion = (typeof POOL_REGIONS)[number];

export const DEFAULT_REGION: PoolRegion = "quiniela";

// ---------------------------------------------------------------------------
// Country → region mapping
// ---------------------------------------------------------------------------

const COUNTRY_TO_REGION: Record<string, PoolRegion> = {
  // polla — Colombia, Chile, Venezuela, Perú
  CO: "polla",
  CL: "polla",
  VE: "polla",
  PE: "polla",

  // prode — Argentina
  AR: "prode",

  // penca — Uruguay
  UY: "penca",

  // porra — España
  ES: "porra",

  // quiniela — México, Ecuador (explicit) + everything else (default)
  MX: "quiniela",
  EC: "quiniela",
};

export function regionFromCountryCode(countryCode: string): PoolRegion {
  return COUNTRY_TO_REGION[countryCode.toUpperCase()] ?? DEFAULT_REGION;
}

// ---------------------------------------------------------------------------
// Spanish term variants — full grammatical data for each region
// ---------------------------------------------------------------------------

export interface PoolTermsES {
  /** Base term: "quiniela", "polla", "prode", "penca", "porra" */
  term: string;
  /** Capitalised: "Quiniela" */
  termUpper: string;
  /** Plural: "quinielas" */
  plural: string;
  /** Capitalised plural: "Quinielas" */
  pluralUpper: string;
  /** Definite article: "la" / "el" */
  article: string;
  /** Capitalised article: "La" / "El" */
  articleUpper: string;
  /** Indefinite article: "una" / "un" */
  indefinite: string;
  /** Demonstrative: "esta" / "este" */
  demonstrative: string;
  /** Demonstrative capitalised: "Esta" / "Este" */
  demonstrativeUpper: string;
  /** Adjective singular: "deportiva" / "deportivo" / "futbolera" */
  adj: string;
  /** Adjective plural: "deportivas" / "deportivos" / "futboleras" */
  adjPlural: string;
  /** Full name: "quiniela deportiva", "polla futbolera", etc. */
  fullName: string;
  /** Full name capitalised: "Quiniela Deportiva" */
  fullNameUpper: string;
  /** Full name plural: "quinielas deportivas" */
  fullNamePlural: string;
  /** Full name plural capitalised: "Quinielas Deportivas" */
  fullNamePluralUpper: string;
}

const ES_TERMS: Record<PoolRegion, PoolTermsES> = {
  quiniela: {
    term: "quiniela",
    termUpper: "Quiniela",
    plural: "quinielas",
    pluralUpper: "Quinielas",
    article: "la",
    articleUpper: "La",
    indefinite: "una",
    demonstrative: "esta",
    demonstrativeUpper: "Esta",
    adj: "deportiva",
    adjPlural: "deportivas",
    fullName: "quiniela deportiva",
    fullNameUpper: "Quiniela Deportiva",
    fullNamePlural: "quinielas deportivas",
    fullNamePluralUpper: "Quinielas Deportivas",
  },
  polla: {
    term: "polla",
    termUpper: "Polla",
    plural: "pollas",
    pluralUpper: "Pollas",
    article: "la",
    articleUpper: "La",
    indefinite: "una",
    demonstrative: "esta",
    demonstrativeUpper: "Esta",
    adj: "futbolera",
    adjPlural: "futboleras",
    fullName: "polla futbolera",
    fullNameUpper: "Polla Futbolera",
    fullNamePlural: "pollas futboleras",
    fullNamePluralUpper: "Pollas Futboleras",
  },
  prode: {
    term: "prode",
    termUpper: "Prode",
    plural: "prodes",
    pluralUpper: "Prodes",
    article: "el",
    articleUpper: "El",
    indefinite: "un",
    demonstrative: "este",
    demonstrativeUpper: "Este",
    adj: "deportivo",
    adjPlural: "deportivos",
    fullName: "prode deportivo",
    fullNameUpper: "Prode Deportivo",
    fullNamePlural: "prodes deportivos",
    fullNamePluralUpper: "Prodes Deportivos",
  },
  penca: {
    term: "penca",
    termUpper: "Penca",
    plural: "pencas",
    pluralUpper: "Pencas",
    article: "la",
    articleUpper: "La",
    indefinite: "una",
    demonstrative: "esta",
    demonstrativeUpper: "Esta",
    adj: "de fútbol",
    adjPlural: "de fútbol",
    fullName: "penca de fútbol",
    fullNameUpper: "Penca de Fútbol",
    fullNamePlural: "pencas de fútbol",
    fullNamePluralUpper: "Pencas de Fútbol",
  },
  porra: {
    term: "porra",
    termUpper: "Porra",
    plural: "porras",
    pluralUpper: "Porras",
    article: "la",
    articleUpper: "La",
    indefinite: "una",
    demonstrative: "esta",
    demonstrativeUpper: "Esta",
    adj: "deportiva",
    adjPlural: "deportivas",
    fullName: "porra deportiva",
    fullNameUpper: "Porra Deportiva",
    fullNamePlural: "porras deportivas",
    fullNamePluralUpper: "Porras Deportivas",
  },
};

export function getPoolTermsES(region: PoolRegion): PoolTermsES {
  return ES_TERMS[region];
}

// ---------------------------------------------------------------------------
// English & Portuguese — single term, minimal variants
// ---------------------------------------------------------------------------

export interface PoolTermsSimple {
  term: string;
  termUpper: string;
  plural: string;
  pluralUpper: string;
}

const EN_TERMS: PoolTermsSimple = {
  term: "pool",
  termUpper: "Pool",
  plural: "pools",
  pluralUpper: "Pools",
};

const PT_TERMS: PoolTermsSimple = {
  term: "bolão",
  termUpper: "Bolão",
  plural: "bolões",
  pluralUpper: "Bolões",
};

export function getPoolTermsEN(): PoolTermsSimple {
  return EN_TERMS;
}

export function getPoolTermsPT(): PoolTermsSimple {
  return PT_TERMS;
}

// ---------------------------------------------------------------------------
// Flat params object for ICU message interpolation
// ---------------------------------------------------------------------------

/**
 * Returns a flat record of all term variants, ready to spread into
 * next-intl's `t("key", params)` calls.
 *
 * For Spanish this includes ~16 keys (term, termUpper, plural, article, …).
 * For EN/PT it includes 4 keys (term, termUpper, plural, pluralUpper).
 */
export function getPoolTermParams(
  locale: string,
  region: PoolRegion,
): Record<string, string> {
  if (locale === "en") {
    return { ...EN_TERMS };
  }
  if (locale === "pt") {
    return { ...PT_TERMS };
  }
  // Spanish (default)
  return { ...ES_TERMS[region] };
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export const POOL_REGION_COOKIE = "pool-region";

export function isValidRegion(value: unknown): value is PoolRegion {
  return (
    typeof value === "string" &&
    POOL_REGIONS.includes(value as PoolRegion)
  );
}
