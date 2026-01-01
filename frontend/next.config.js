/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.cloudgpus.io",
      },
    ],
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
