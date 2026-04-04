import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/pools/", "/admin/", "/profile/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
