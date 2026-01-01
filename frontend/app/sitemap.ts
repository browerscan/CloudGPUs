import type { MetadataRoute } from "next";
import { listGpuModels, listProviders } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { CALCULATOR_PAGES, REGION_PAGES, USE_CASE_PAGES } from "@/lib/pseo";

// Budget pages
const BUDGET_PAGES = [
  { slug: "under-1-per-hour" },
  { slug: "under-2-per-hour" },
  { slug: "under-500-per-month" },
  { slug: "under-1000-per-month" },
] as const;

// Architecture pages
const ARCHITECTURE_PAGES = [
  { slug: "blackwell" },
  { slug: "hopper" },
  { slug: "ampere" },
  { slug: "adam" },
  { slug: "hopper-predecessor" },
] as const;

// Form factor pages
const FORM_FACTOR_PAGES = [{ slug: "pcie" }, { slug: "sxm" }, { slug: "nvl" }] as const;

// Feature filter pages
const FEATURE_FILTER_PAGES = [
  { path: "gpus-with-infiniband", priority: 0.7 },
  { path: "gpus-with-nvlink", priority: 0.7 },
  { path: "gpus-over-80gb-vram", priority: 0.7 },
  { path: "spot-instances-only", priority: 0.65 },
] as const;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [gpus, providers] = await Promise.all([listGpuModels(), listProviders()]).catch(() => [
    null,
    null,
  ]);

  const now = new Date();
  const providerSlugs = (providers?.docs ?? []).map((p) => p.slug).sort();

  const providerComparisons: MetadataRoute.Sitemap = [];
  for (let i = 0; i < providerSlugs.length; i++) {
    for (let j = i + 1; j < providerSlugs.length; j++) {
      const a = providerSlugs[i]!;
      const b = providerSlugs[j]!;
      providerComparisons.push({
        url: `https://cloudgpus.io/compare/${a}-vs-${b}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  const gpuComparisons: MetadataRoute.Sitemap = [];
  // Keep GPU-vs-GPU sitemaps smaller; focus on top N by VRAM.
  const gpuTop = (gpus?.docs ?? [])
    .slice(0, 25)
    .map((g) => seoGpuSlug(g.slug))
    .sort();
  for (let i = 0; i < gpuTop.length; i++) {
    for (let j = i + 1; j < gpuTop.length; j++) {
      const a = gpuTop[i]!;
      const b = gpuTop[j]!;
      gpuComparisons.push({
        url: `https://cloudgpus.io/compare/${a}-vs-${b}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.55,
      });
    }
  }

  // Provider + GPU combo pages (limited to top providers and GPUs)
  const providerGpuCombos: MetadataRoute.Sitemap = [];
  const topProviders = (providers?.docs ?? []).slice(0, 10);
  const topGpusForCombos = (gpus?.docs ?? []).slice(0, 15);
  for (const provider of topProviders) {
    for (const gpu of topGpusForCombos) {
      providerGpuCombos.push({
        url: `https://cloudgpus.io/${provider.slug}/${seoGpuSlug(gpu.slug)}`,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: 0.65,
      });
    }
  }

  return [
    { url: "https://cloudgpus.io/", lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: "https://cloudgpus.io/cloud-gpu",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://cloudgpus.io/provider",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: "https://cloudgpus.io/compare",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://cloudgpus.io/best-gpu-for",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://cloudgpus.io/region",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://cloudgpus.io/calculator",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...CALCULATOR_PAGES.map((p) => ({
      url: `https://cloudgpus.io/calculator/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.55,
    })),
    ...USE_CASE_PAGES.map((u) => ({
      url: `https://cloudgpus.io/best-gpu-for/${u.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...REGION_PAGES.map((r) => ({
      url: `https://cloudgpus.io/region/${r.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Budget pages
    ...BUDGET_PAGES.map((b) => ({
      url: `https://cloudgpus.io/budget/${b.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // Architecture pages
    ...ARCHITECTURE_PAGES.map((a) => ({
      url: `https://cloudgpus.io/architecture/${a.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Form factor pages
    ...FORM_FACTOR_PAGES.map((f) => ({
      url: `https://cloudgpus.io/form-factor/${f.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    // Feature filter pages
    ...FEATURE_FILTER_PAGES.map((f) => ({
      url: `https://cloudgpus.io/${f.path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: f.priority as number,
    })),
    ...(gpus?.docs ?? []).map((g) => ({
      url: `https://cloudgpus.io/cloud-gpu/${seoGpuSlug(g.slug)}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
    ...(providers?.docs ?? []).map((p) => ({
      url: `https://cloudgpus.io/provider/${p.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
    ...providerComparisons,
    ...gpuComparisons,
    ...providerGpuCombos,
  ];
}
