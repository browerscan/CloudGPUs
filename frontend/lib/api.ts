import { env } from "./env";

export type PaginatedResponse<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

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
};

export type GpuModel = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  architecture: string;
  vram_gb: number;
  memory_type: string;
  memory_bandwidth_gbps?: number | null;
  tdp_watts?: number | null;
  is_datacenter?: boolean;
  is_consumer?: boolean;
  generation_year?: number | null;
};

export type ComparePricesResponse = {
  gpu: GpuModel;
  prices: Array<{
    provider: {
      slug: string;
      name: string;
      displayName: string;
      reliabilityTier: string;
      affiliateUrl: string | null;
    };
    instance: {
      instanceType: string;
      gpuCount: number;
      vcpuCount: number | null;
      ramGb: number | null;
      networkBandwidthGbps: number | null;
      hasNvlink: boolean | null;
      hasInfiniband: boolean | null;
      infinibandBandwidthGbps: number | null;
      billingIncrementSeconds: number | null;
      minRentalHours: number | null;
      regions: string[] | null;
    };
    onDemand: number | null;
    spot: number | null;
    availability: string;
    lastUpdated: string;
  }>;
  stats: {
    min: number | null;
    max: number | null;
    median: number | null;
    providerCount: number;
  };
  generatedAt: string;
};

export type CompareProvidersResponse = {
  provider1: Provider;
  provider2: Provider;
  commonGpus: Array<{
    gpu: { slug: string; name: string };
    provider1: { onDemand: number | null; spot: number | null };
    provider2: { onDemand: number | null; spot: number | null };
  }>;
  verdict: {
    cheaper: string | "tie";
    moreGpus: string | "tie";
    betterFor: Array<{ useCase: string; provider: string }>;
  };
  generatedAt: string;
};

export type PriceHistoryResponse = {
  gpu: GpuModel;
  days: number;
  provider: string | null;
  points: Array<{
    day: string;
    min: number | null;
    avg: number | null;
    max: number | null;
    samples: number;
  }>;
  generatedAt: string;
};

// Auth types
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  isVerified: boolean;
  createdAt?: string;
  lastLoginAt?: string;
};

export type AuthResponse = {
  status: number;
  message: string;
  data: {
    user: AuthUser;
    accessToken: string;
  };
};

export type MeResponse = {
  status: number;
  data: {
    user: AuthUser;
  };
};

export type SavedComparison = {
  id: string;
  comparisonType: "gpu" | "provider";
  comparisonKey: string;
  items: unknown;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComparisonsResponse = {
  status: number;
  data: {
    comparisons: SavedComparison[];
  };
};

export type UserAlert = {
  id: string;
  targetPricePerGpuHour: number;
  isActive: boolean;
  confirmedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string;
  gpu: { slug: string; name: string };
  provider: { slug: string; name: string } | null;
};

export type AlertsResponse = {
  status: number;
  data: {
    alerts: UserAlert[];
  };
};

// Get stored auth token
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

// Set auth token
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("auth_token", token);
}

// Clear auth token
export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
}

// Get current user from localStorage (synchronous)
export function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("auth_user");
  return data ? (JSON.parse(data) as AuthUser) : null;
}

// Set cached user
export function setCachedUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("auth_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("auth_user");
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, env.apiBaseUrl);
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      accept: "application/json",
    },
    next: init?.next,
  });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
  return (await res.json()) as T;
}

export async function listGpuModels() {
  return apiGet<PaginatedResponse<GpuModel>>("/api/gpu-models?limit=100&sort=-vram_gb", {
    next: { revalidate: 3600 },
  });
}

export async function listProviders() {
  return apiGet<PaginatedResponse<Provider>>("/api/providers?limit=200&sort=name", {
    next: { revalidate: 900 },
  });
}

export async function getGpuModel(slug: string) {
  return apiGet<GpuModel>(`/api/gpu-models/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600 },
  });
}

export async function getProvider(slug: string) {
  return apiGet<Provider>(`/api/providers/${encodeURIComponent(slug)}`, {
    next: { revalidate: 900 },
  });
}

export async function comparePrices(gpuSlug: string) {
  const url = `/api/compare-prices?gpuSlug=${encodeURIComponent(gpuSlug)}&includeSpot=true`;
  return apiGet<ComparePricesResponse>(url, { next: { revalidate: 600 } });
}

export async function compareProviders(a: string, b: string) {
  const url = `/api/compare-providers?providers=${encodeURIComponent(`${a},${b}`)}`;
  return apiGet<CompareProvidersResponse>(url, { next: { revalidate: 900 } });
}

export async function priceHistory(gpuSlug: string, days = 30, provider?: string) {
  const params = new URLSearchParams({ gpuSlug, days: String(days) });
  if (provider) params.set("provider", provider);
  return apiGet<PriceHistoryResponse>(`/api/price-history?${params.toString()}`, {
    next: { revalidate: 1800 },
  });
}

export async function getCheapestToday() {
  return apiGet<{
    generatedAt: string;
    items: Array<{
      gpuSlug: string;
      gpuName: string;
      cheapestProvider: string;
      cheapestPricePerGpuHour: number;
    }>;
  }>("/api/stats/cheapest", { next: { revalidate: 300 } });
}

export function affiliateClickUrl(args: { providerSlug: string; gpuSlug?: string }) {
  const url = new URL("/api/affiliate/click", env.apiBaseUrl);
  url.searchParams.set("provider", args.providerSlug);
  if (args.gpuSlug) url.searchParams.set("gpu", args.gpuSlug);
  url.searchParams.set("utm_source", "cloudgpus.io");
  url.searchParams.set("utm_medium", "referral");
  return url.toString();
}

// Auth API calls with automatic token injection
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, env.apiBaseUrl);
  const token = getAuthToken();

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  // Merge additional headers from init
  if (init?.headers) {
    const initHeaders = init.headers as Record<string, string>;
    Object.assign(headers, initHeaders);
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || err.message || `API ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function register(email: string, password: string, name?: string) {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function requestMagicLink(email: string) {
  return apiFetch<{ status: number; message: string }>("/api/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(token: string) {
  return apiFetch<{ status: number; message: string; data?: { userId: string; email: string } }>(
    `/api/auth/verify?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
}

export async function resendVerify(email: string) {
  return apiFetch<{ status: number; message: string }>("/api/auth/resend-verify", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetch<{ status: number; message: string }>("/api/auth/request-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiFetch<{ status: number; message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function getMe() {
  return apiFetch<MeResponse>("/api/me", { method: "GET" });
}

export async function updateMe(name: string) {
  return apiFetch<MeResponse>("/api/me", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function saveComparison(
  comparisonType: "gpu" | "provider",
  comparisonKey: string,
  items: unknown,
  name?: string,
) {
  return apiFetch<{ status: number; message: string; data: { comparison: SavedComparison } }>(
    "/api/me/comparisons",
    {
      method: "POST",
      body: JSON.stringify({ comparisonType, comparisonKey, items, name }),
    },
  );
}

export async function getComparisons() {
  return apiFetch<ComparisonsResponse>("/api/me/comparisons", { method: "GET" });
}

export async function deleteComparison(id: string) {
  return apiFetch<{ status: number; message: string }>(`/api/me/comparisons/${id}`, {
    method: "DELETE",
  });
}

export async function getAlerts() {
  return apiFetch<AlertsResponse>("/api/me/alerts", { method: "GET" });
}

export async function claimAlert(id: string) {
  return apiFetch<{ status: number; message: string }>(`/api/me/alerts/${id}/claim`, {
    method: "POST",
  });
}
