const GPU_SLUG_ALIASES: Record<string, string> = {
  // High-level SEO slugs
  b200: "b200-sxm",
  gb200: "gb200-nvl",
  h200: "h200-sxm",
  h100: "h100-sxm",
};

const GPU_SEO_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(GPU_SLUG_ALIASES).map(([alias, canonical]) => [canonical, alias]),
);

export function normalizeGpuSlug(slug: string) {
  return GPU_SLUG_ALIASES[slug] ?? slug;
}

export function seoGpuSlug(slug: string) {
  return GPU_SEO_SLUGS[slug] ?? slug;
}

const PROVIDER_SLUG_ALIASES: Record<string, string> = {
  "google-cloud": "gcp",
  latitude: "latitude-sh",
};

export function normalizeProviderSlug(slug: string) {
  return PROVIDER_SLUG_ALIASES[slug] ?? slug;
}
