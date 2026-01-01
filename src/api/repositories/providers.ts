import type { Pool } from "pg";
import type { Provider } from "../types.js";

export async function listProviders(args: {
  pool: Pool;
  whereSql: string;
  whereValues: unknown[];
  limit: number;
  offset: number;
  orderBy: string;
}) {
  const countRes = await args.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM cloudgpus.providers ${args.whereSql}`,
    args.whereValues,
  );
  const totalDocs = Number(countRes.rows[0]?.count ?? 0);

  const rowsRes = await args.pool.query<Provider>(
    `
    SELECT
      id, slug, name, display_name, provider_type, reliability_tier,
      website_url, pricing_url, docs_url, status_page_url,
      has_public_api, supports_spot_instances, supports_reserved_instances,
      available_regions, affiliate_url, sla_uptime_percent,
      last_price_update, created_at, updated_at
    FROM cloudgpus.providers
    ${args.whereSql}
    ${args.orderBy}
    LIMIT $${args.whereValues.length + 1}
    OFFSET $${args.whereValues.length + 2}
    `,
    [...args.whereValues, args.limit, args.offset],
  );

  return { totalDocs, docs: rowsRes.rows };
}

export async function getProviderBySlug(pool: Pool, slug: string) {
  const res = await pool.query<Provider>(
    `
    SELECT
      id, slug, name, display_name, provider_type, reliability_tier,
      website_url, pricing_url, docs_url, status_page_url,
      has_public_api, supports_spot_instances, supports_reserved_instances,
      available_regions, affiliate_url, sla_uptime_percent,
      last_price_update, created_at, updated_at
    FROM cloudgpus.providers
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );
  return res.rows[0] ?? null;
}
