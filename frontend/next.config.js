/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Cloudflare Workers deployment - skip ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript errors during builds (for faster iteration)
  typescript: {
    ignoreBuildErrors: true,
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
