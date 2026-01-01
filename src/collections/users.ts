import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  dbName: "users",
  auth: true,
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "is_verified", "created_at"],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    create: async ({ req }) => {
      if (req.user) return true;
      const existing = await req.payload.db.findOne({ collection: "users", req });
      return !existing;
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "is_verified",
      type: "checkbox",
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "verify_token",
      type: "text",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "verify_expires_at",
      type: "date",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "verified_at",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "reset_token",
      type: "text",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "reset_expires_at",
      type: "date",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: "last_login_at",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "last_login_ip",
      type: "text",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "created_at",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
      },
    },
    {
      name: "updated_at",
      type: "date",
      admin: {
        readOnly: true,
        position: "sidebar",
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === "create") {
          data.created_at = new Date();
        }
        data.updated_at = new Date();
        return data;
      },
    ],
  },
};
