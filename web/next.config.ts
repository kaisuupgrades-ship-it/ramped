import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Allow Simple Icons CDN for brand logos in the questionnaire stack picker.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.simpleicons.org" },
    ],
  },
  // Tighten production bundles
  poweredByHeader: false,
  // typedRoutes intentionally OFF for now — re-enable after Button's href type
  // is broadened to accept external URLs (currently breaks the strict
  // `<Link href>` constraint that typedRoutes enforces).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default config;
