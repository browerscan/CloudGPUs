export type Provider = {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  provider_type: string;
  reliability_tier: string;
  website_url: string;
  pricing_url: string | null;
  docs_url: string | null;
  status_page_url: string | null;
  has_public_api: boolean;
  supports_spot_instances: boolean | null;
  supports_reserved_instances: boolean | null;
  available_regions: string[] | null;
  affiliate_url: string | null;
  sla_uptime_percent: string | null;
  last_price_update: string | null;
  created_at: string;
  updated_at: string;
};

export type GpuModel = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  architecture: string;
  vram_gb: number;
  memory_type: string;
  memory_bandwidth_gbps: number | null;
  tdp_watts: number | null;
  is_datacenter: boolean;
  is_consumer: boolean;
  generation_year: number | null;
  created_at: string;
  updated_at: string;
};

export type Instance = {
  id: string;
  provider_id: string;
  gpu_model_id: string;
  instance_type: string;
  gpu_count: number;
  vcpu_count: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  price_per_hour: string;
  price_per_gpu_hour: string;
  price_per_hour_spot: string | null;
  availability_status: string;
  is_active: boolean;
  last_scraped_at: string;
  updated_at: string;
  created_at: string;
};
