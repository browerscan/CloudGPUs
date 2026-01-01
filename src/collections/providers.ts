import type { CollectionConfig } from "payload";

const PROVIDER_TYPE_OPTIONS = [
  { label: "Specialized NeoCloud", value: "specialized_neocloud" },
  { label: "Hyperscaler", value: "hyperscaler" },
  { label: "Regional Cloud", value: "regional_cloud" },
  { label: "Marketplace", value: "marketplace" },
  { label: "DePIN", value: "depin" },
  { label: "Bare Metal", value: "bare_metal" },
] as const;

const RELIABILITY_TIER_OPTIONS = [
  { label: "Enterprise", value: "enterprise" },
  { label: "Standard", value: "standard" },
  { label: "Community", value: "community" },
] as const;

export const Providers: CollectionConfig = {
  slug: "providers",
  dbName: "providers",
  timestamps: false,
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "slug",
      "name",
      "provider_type",
      "reliability_tier",
      "is_active",
      "last_price_update",
    ],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    create: () => false,
    delete: () => false,
  },
  fields: [
    { name: "slug", type: "text", required: true, unique: true, index: true },
    { name: "name", type: "text", required: true },
    { name: "display_name", type: "text", required: true },
    {
      name: "provider_type",
      type: "select",
      required: true,
      enumName: "provider_type",
      options: [...PROVIDER_TYPE_OPTIONS],
    },
    {
      name: "reliability_tier",
      type: "select",
      required: true,
      enumName: "reliability_tier",
      options: [...RELIABILITY_TIER_OPTIONS],
    },
    { name: "headquarters_country", type: "text" },
    { name: "founded_year", type: "number", min: 1970, max: 2100 },
    { name: "website_url", type: "text", required: true },
    { name: "pricing_url", type: "text" },
    { name: "docs_url", type: "text" },
    { name: "status_page_url", type: "text" },
    { name: "api_base_url", type: "text" },
    { name: "api_auth_type", type: "text" },
    { name: "has_public_api", type: "checkbox" },
    { name: "api_rate_limit_rpm", type: "number", min: 0 },
    { name: "affiliate_url", type: "text" },
    { name: "affiliate_program_name", type: "text" },
    { name: "affiliate_commission_percent", type: "number", min: 0, max: 100 },
    { name: "affiliate_cookie_days", type: "number", min: 0, max: 3650 },
    { name: "sla_uptime_percent", type: "number", min: 0, max: 100 },
    { name: "supports_spot_instances", type: "checkbox" },
    { name: "supports_reserved_instances", type: "checkbox" },
    { name: "supports_bare_metal", type: "checkbox" },
    { name: "min_billing_increment_seconds", type: "number", min: 0 },
    {
      name: "available_regions",
      // Keep a single column compatible with the existing `TEXT[]`/`JSONB` storage strategy.
      // This avoids Payload creating a relational "hasMany" table and Drizzle attempting to drop the column.
      type: "json",
      admin: { description: 'JSON array of region slugs, e.g. ["us-east", "europe"].' },
    },
    { name: "description", type: "textarea" },
    { name: "pros", type: "json", admin: { description: "JSON array of short bullets." } },
    { name: "cons", type: "json", admin: { description: "JSON array of short bullets." } },
    { name: "best_for", type: "json", admin: { description: "JSON array of short bullets." } },
    { name: "logo_url", type: "text" },
    { name: "brand_color", type: "text" },
    { name: "is_active", type: "checkbox" },
    { name: "last_price_update", type: "date", admin: { readOnly: true, position: "sidebar" } },
    { name: "created_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
    { name: "updated_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
  ],
};
