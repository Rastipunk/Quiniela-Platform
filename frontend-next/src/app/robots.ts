import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export default function robots(): MetadataRoute.Robots {
  // Auth pages (login, forgot-password, etc.) are intentionally NOT in
  // Disallow. Each one ships meta robots noindex,nofollow — but Google
  // can only honor that signal if it is allowed to crawl the page.
  // Blocking via robots.txt prevents the noindex from ever being read,
  // so previously-indexed URLs stay in the index forever (we hit this
  // on /login: 84 historical impressions in GSC).
  //
  // Authenticated routes that expose user data stay in Disallow because
  // we never want them crawled at all.
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
          "/pago/",
          "/invite",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
