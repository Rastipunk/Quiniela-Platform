import type { MetadataRoute } from "next";
import { headers } from "next/headers";

interface ManifestStrings {
  name: string;
  shortName: string;
  description: string;
  lang: string;
}

const STRINGS: Record<string, ManifestStrings> = {
  es: {
    name: "Picks4All — Quinielas Deportivas Gratis",
    shortName: "Picks4All",
    description:
      "Plataforma gratuita de quinielas deportivas para competir con amigos prediciendo resultados de futbol. Mundial 2026, Champions League y mas.",
    lang: "es-LA",
  },
  en: {
    name: "Picks4All — Free Sports Pools",
    shortName: "Picks4All",
    description:
      "Free sports pool platform to compete with friends predicting football results. World Cup 2026, Champions League, and more.",
    lang: "en-US",
  },
  pt: {
    name: "Picks4All — Bolões Esportivos Grátis",
    shortName: "Picks4All",
    description:
      "Plataforma gratuita de bolões esportivos para competir com amigos prevendo resultados de futebol. Copa do Mundo 2026, Champions League e mais.",
    lang: "pt-BR",
  },
};

/** Pick the best locale from an Accept-Language header value. */
function detectLocale(acceptLanguage: string | null): "es" | "en" | "pt" {
  if (!acceptLanguage) return "es";
  const tags = acceptLanguage
    .toLowerCase()
    .split(",")
    .map((tag) => tag.split(";")[0]?.trim() ?? "");
  for (const tag of tags) {
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("en")) return "en";
    if (tag.startsWith("es")) return "es";
  }
  return "es";
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headerList = await headers();
  const locale = detectLocale(headerList.get("accept-language"));
  const s = STRINGS[locale] ?? STRINGS.es;

  return {
    name: s.name,
    short_name: s.shortName,
    description: s.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f4f5f7",
    lang: s.lang,
    categories: ["sports", "entertainment", "games", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
