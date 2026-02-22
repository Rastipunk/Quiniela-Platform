import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Picks4All — Quinielas Deportivas Gratis",
    short_name: "Picks4All",
    description:
      "Plataforma gratuita de quinielas deportivas para competir con amigos prediciendo resultados de futbol. Mundial 2026, Champions League y mas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f4f5f7",
    lang: "es",
    categories: ["sports", "entertainment", "games"],
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/pwa-icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
