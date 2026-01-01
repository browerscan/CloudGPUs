import type { CollectionConfig } from "payload";

export const ProviderReviews: CollectionConfig = {
  slug: "provider_reviews",
  dbName: "provider_reviews",
  timestamps: false,
  admin: {
    useAsTitle: "title",
    defaultColumns: ["provider", "rating", "title", "is_published", "created_at"],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    create: () => false,
    delete: () => false,
  },
  fields: [
    // Relationship fields store the foreign key in a `{field}_id` column.
    // Use `provider` to map cleanly onto the existing `provider_id` column.
    { name: "provider", type: "relationship", relationTo: "providers", required: true },
    { name: "rating", type: "number", required: true, min: 1, max: 5 },
    { name: "title", type: "text" },
    { name: "body", type: "textarea", required: true },
    { name: "author_name", type: "text" },
    { name: "author_email", type: "text" },
    { name: "is_published", type: "checkbox" },
    { name: "published_at", type: "date" },
    { name: "created_at", type: "date", admin: { readOnly: true, position: "sidebar" } },
  ],
};
