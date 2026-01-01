export type AvailabilityStatus =
  | "available"
  | "limited"
  | "waitlist"
  | "sold_out"
  | "contact_sales"
  | "deprecated";

export type PricingInstance = {
  providerSlug: string;
  gpuSlug: string;
  instanceType: string;
  instanceName?: string;
  gpuCount: number;
  pricePerHour: number;
  pricePerHourSpot?: number;
  currency?: string;
  vcpuCount?: number;
  ramGb?: number;
  storageGb?: number;
  availabilityStatus?: AvailabilityStatus;
  regions?: string[];
  instanceUrl?: string;
  sourceUrl?: string;
  rawData?: unknown;
};

export type ProviderContext = {
  id: string;
  slug: string;
  name?: string;
  pricingUrl?: string | null;
  apiBaseUrl?: string | null;
  hasPublicApi?: boolean;
  providerType?: string;
  reliabilityTier?: string;
  supportsSpotInstances?: boolean;
  supportsReservedInstances?: boolean;
};

export type ScrapeClient = {
  fetchText: (args: {
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }) => Promise<{ finalUrl: string; status: number; text: string }>;

  fetchJson: <T>(args: {
    url: string;
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    timeoutMs?: number;
  }) => Promise<{ finalUrl: string; status: number; json: T }>;

  browserHtml: (args: {
    url: string;
    timeoutMs?: number;
    waitUntil?: "domcontentloaded" | "networkidle";
    blockResources?: boolean;
  }) => Promise<{ finalUrl: string; html: string }>;
};

export type AdapterContext = {
  provider: ProviderContext;
  now: Date;
  scrape: ScrapeClient;
};

export interface ProviderAdapter {
  slug: string;
  fetchPricing(ctx: AdapterContext): Promise<PricingInstance[]>;
}
