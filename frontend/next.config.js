/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(projectRoot, "..");

const nextConfig = {
  // Silence monorepo root inference warnings.
  outputFileTracingRoot: workspaceRoot,

  // Build-time gates: keep strict by default; allow explicit opt-out for quick iteration.
  eslint: {
    ignoreDuringBuilds: process.env["SKIP_NEXT_LINT"] === "true",
  },
  typescript: {
    ignoreBuildErrors: process.env["SKIP_NEXT_TYPECHECK"] === "true",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.cloudgpus.io",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  async redirects() {
    return [
      { source: "/gpus", destination: "/cloud-gpu", permanent: true },
      { source: "/gpu/:slug", destination: "/cloud-gpu/:slug", permanent: true },
      { source: "/providers", destination: "/provider", permanent: true },
    ];
  },
};

export default nextConfig;
