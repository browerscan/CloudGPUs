import type { CollectionConfig } from "payload";

const ARCH_OPTIONS = [
  { label: "Blackwell", value: "blackwell" },
  { label: "Hopper", value: "hopper" },
  { label: "Ada Lovelace", value: "ada_lovelace" },
  { label: "Ampere", value: "ampere" },
  { label: "Turing", value: "turing" },
  { label: "Volta", value: "volta" },
  { label: "Consumer Blackwell", value: "consumer_blackwell" },
] as const;

export const GpuModels: CollectionConfig = {
  slug: "gpu_models",
  dbName: "gpu_models",
  timestamps: false,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["slug", "name", "architecture", "vram_gb", "is_datacenter", "generation_year"],
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
    { name: "short_name", type: "text", required: true },
    { name: "manufacturer", type: "text", required: true },
    {
      name: "architecture",
      type: "select",
      required: true,
      enumName: "gpu_architecture",
      options: [...ARCH_OPTIONS],
    },
    { name: "vram_gb", type: "number", required: true, min: 1, max: 2048 },
    { name: "memory_type", type: "text", required: true },
    { name: "memory_bandwidth_gbps", type: "number", min: 0 },
    { name: "tdp_watts", type: "number", min: 0 },
    { name: "fp64_tflops", type: "number", min: 0 },
    { name: "fp32_tflops", type: "number", min: 0 },
    { name: "fp16_tflops", type: "number", min: 0 },
    { name: "fp8_tflops", type: "number", min: 0 },
    { name: "int8_tops", type: "number", min: 0 },
    { name: "form_factor", type: "text" },
    { name: "interconnect", type: "text" },
    { name: "is_datacenter", type: "checkbox" },
    { name: "is_consumer", type: "checkbox" },
    { name: "generation_year", type: "number", min: 1990, max: 2100 },
    { name: "description", type: "textarea" },
    { name: "use_cases", type: "json", admin: { description: "JSON array of use case slugs." } },
    { name: "created_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
    { name: "updated_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
  ],
};
