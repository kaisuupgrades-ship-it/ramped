import type { MetadataRoute } from "next";

/**
 * robots.txt — allow public pages, disallow gated/internal routes.
 * Sitemap reference helps search engines discover the full site.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/portal",
          "/portal/",
          "/roadmap",
          "/roadmap/",
          "/map/",
          "/thanks",
          "/api/",
        ],
      },
    ],
    sitemap: "https://www.30dayramp.com/sitemap.xml",
    host: "https://www.30dayramp.com",
  };
}
