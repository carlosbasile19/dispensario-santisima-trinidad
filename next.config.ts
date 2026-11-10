import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Profile photos are uploaded through a Server Action (limit 2 MB per
    // photo, enforced again by the avatars bucket); the default cap is 1 MB.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // The lab PDF's fonts and mark are read from disk when a report is rendered
  // (the PDF route, and the WhatsApp send from the report page).
  outputFileTracingIncludes: {
    "/dashboard/laboratorio/**": ["./assets/lab-pdf/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
