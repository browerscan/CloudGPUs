const PROVIDER_SLUG_ALIASES: Record<string, string> = {
  // Docs / SEO aliases
  "google-cloud": "gcp",
  latitude: "latitude-sh",
};

const GPU_SLUG_ALIASES: Record<string, string> = {
  // High-level slugs used in SEO docs
  b200: "b200-sxm",
  gb200: "gb200-nvl",
  h200: "h200-sxm",
  h100: "h100-sxm",
};

export function normalizeProviderSlug(slug: string) {
  return PROVIDER_SLUG_ALIASES[slug] ?? slug;
}

export function normalizeGpuSlug(slug: string) {
  return GPU_SLUG_ALIASES[slug] ?? slug;
}
