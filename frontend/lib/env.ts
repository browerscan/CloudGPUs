export const env = {
  apiBaseUrl: process.env["NEXT_PUBLIC_API_BASE_URL"] ?? "https://api.cloudgpus.io",
  // Server-side API key for SSG builds and runtime (bypasses rate limiting)
  // BUILD_API_KEY for local builds, API_KEY for Cloudflare Workers runtime
  apiKey: process.env["BUILD_API_KEY"] ?? process.env["API_KEY"] ?? null,
};
