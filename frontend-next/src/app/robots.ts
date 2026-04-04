import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/pools/",
          "/admin/",
          "/profile/",
          "/login",
          "/forgot-password",
          "/verify-email",
          "/reset-password",
          "/activar-cuenta",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
