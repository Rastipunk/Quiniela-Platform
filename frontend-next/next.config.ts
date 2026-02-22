import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Railway deployment
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/football/**",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      // WORKAROUND: Remove legacy polyfills (~13.5 KiB) for modern browsers.
      // Next.js unconditionally injects polyfill-module regardless of browserslist.
      // Remove this once https://github.com/vercel/next.js/pull/88551 lands.
      "../build/polyfills/polyfill-module": "./src/lib/empty-polyfill.js",
      "next/dist/build/polyfills/polyfill-module": "./src/lib/empty-polyfill.js",
    },
  },
  experimental: {
    // Inline CSS into <style> tags to eliminate render-blocking <link> tags.
    // Trade-off: no separate CSS caching, but our CSS is small (~2 KiB).
    inlineCss: true,
  },
};

export default nextConfig;
