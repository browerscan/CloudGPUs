import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/_next/",
          "/preview/",
          "/*?sort=",
          "/*?filter=",
          "/*?page=",
        ],
      },
    ],
    sitemap: "https://cloudgpus.io/sitemap.xml",
  };
}
