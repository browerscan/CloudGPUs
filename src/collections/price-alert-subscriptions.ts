import type { CollectionConfig } from "payload";

export const PriceAlertSubscriptions: CollectionConfig = {
  slug: "price_alert_subscriptions",
  dbName: "price_alert_subscriptions",
  timestamps: false,
  admin: {
    useAsTitle: "email",
    defaultColumns: [
      "email",
      "gpu_model",
      "provider",
      "target_price_per_gpu_hour",
      "is_active",
      "created_at",
    ],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    create: () => false,
    delete: () => false,
  },
  fields: [
    { name: "email", type: "text", required: true, index: true },
    // Relationship fields store the foreign key in a `{field}_id` column.
    // Use `gpu_model` / `provider` to map onto existing `gpu_model_id` / `provider_id` columns.
    { name: "gpu_model", type: "relationship", relationTo: "gpu_models", required: true },
    { name: "provider", type: "relationship", relationTo: "providers" },
    { name: "target_price_per_gpu_hour", type: "number", required: true, min: 0 },
    { name: "is_active", type: "checkbox" },
    { name: "confirm_token", type: "text", admin: { readOnly: true } },
    { name: "confirmed_at", type: "date" },
    { name: "unsubscribe_token", type: "text", admin: { readOnly: true } },
    { name: "last_notified_at", type: "date" },
    { name: "created_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
  ],
};
