import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/pools/", "/admin/", "/profile/"],
      },
    ],
    sitemap: "https://picks4all.com/sitemap.xml",
  };
}
