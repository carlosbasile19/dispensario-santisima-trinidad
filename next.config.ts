import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/avatars/**", supabaseUrl)]
      : [],
  },
  async headers() {
    return [{
      source: "/images/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
    }];
  },
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
