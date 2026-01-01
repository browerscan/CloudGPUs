const GPU_ALIASES: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "b200-sxm", patterns: [/\bB200\b/i] },
  { slug: "gb200-nvl", patterns: [/\bGB200\b/i, /NVL\s*72/i] },
  { slug: "h200-sxm", patterns: [/\bH200\b/i] },

  // H100 variants
  { slug: "h100-pcie", patterns: [/\bH100\b[^\n]{0,40}\bPCIe\b/i, /\bH100\s*PCIe\b/i] },
  { slug: "h100-sxm", patterns: [/\bH100\b[^\n]{0,40}\bSXM\b/i, /\bH100\s*SXM\b/i, /\bH100\b/i] },

  { slug: "a100-80gb", patterns: [/\bA100\b[^\n]{0,40}\b80\s*GB\b/i, /\bA100\s*80\s*GB\b/i] },
  { slug: "a100-40gb", patterns: [/\bA100\b[^\n]{0,40}\b40\s*GB\b/i, /\bA100\s*40\s*GB\b/i] },
  { slug: "a10g", patterns: [/\bA10G\b/i] },
  { slug: "a40", patterns: [/\bA40\b/i] },
  { slug: "l40s", patterns: [/\bL40S\b/i] },
  { slug: "l4", patterns: [/\bL4\b/i] },
  { slug: "t4", patterns: [/\bT4\b/i] },
  { slug: "v100-16gb", patterns: [/\bV100\b/i] },
  { slug: "rtx-5090", patterns: [/\bRTX\s*5090\b/i] },
  { slug: "rtx-4090", patterns: [/\bRTX\s*4090\b/i] },
  { slug: "rtx-3090", patterns: [/\bRTX\s*3090\b/i] },
];

export function normalizeGpuSlug(input: string): string | null {
  const text = input.trim();
  for (const entry of GPU_ALIASES) {
    for (const re of entry.patterns) {
      if (re.test(text)) return entry.slug;
    }
  }
  return null;
}

export function allGpuPatterns() {
  return GPU_ALIASES.flatMap((a) => a.patterns.map((re) => ({ slug: a.slug, re })));
}
