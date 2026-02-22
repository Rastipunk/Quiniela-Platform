import type { NextConfig } from "next";

// Content Security Policy — allow our app + Google services (GA4, GIS)
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://media.api-sports.io https://flagcdn.com https://www.googletagmanager.com https://*.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.picks4all.com https://quiniela-platform-production.up.railway.app https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com",
  "frame-src https://accounts.google.com https://apis.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // COOP omitted: GIS needs cross-origin popup postMessage for OAuth flow
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  output: "standalone", // Required for Railway deployment
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
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
