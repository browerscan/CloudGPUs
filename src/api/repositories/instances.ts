import type { Pool } from "pg";
import type { Instance } from "../types.js";

export type InstanceRow = Instance & {
  provider_slug?: string;
  provider_name?: string;
  provider_display_name?: string;
  provider_reliability_tier?: string;
  provider_affiliate_url?: string | null;
  gpu_slug?: string;
  gpu_name?: string;
  gpu_short_name?: string;
  gpu_vram_gb?: number;
  gpu_architecture?: string;
};

export async function listInstances(args: {
  pool: Pool;
  whereSql: string;
  whereValues: unknown[];
  limit: number;
  offset: number;
  orderBy: string;
  depth: number;
}) {
  const countRes = await args.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM cloudgpus.instances i ${args.whereSql}`,
    args.whereValues,
  );
  const totalDocs = Number(countRes.rows[0]?.count ?? 0);

  const joins =
    args.depth >= 1
      ? `
      LEFT JOIN cloudgpus.providers p ON p.id = i.provider_id
      LEFT JOIN cloudgpus.gpu_models g ON g.id = i.gpu_model_id
    `
      : "";

  const select =
    args.depth >= 1
      ? `
        i.*,
        p.slug as provider_slug,
        p.name as provider_name,
        p.display_name as provider_display_name,
        p.reliability_tier as provider_reliability_tier,
        p.affiliate_url as provider_affiliate_url,
        g.slug as gpu_slug,
        g.name as gpu_name,
        g.short_name as gpu_short_name,
        g.vram_gb as gpu_vram_gb,
        g.architecture as gpu_architecture
      `
      : "i.*";

  const rowsRes = await args.pool.query<InstanceRow>(
    `
    SELECT ${select}
    FROM cloudgpus.instances i
    ${joins}
    ${args.whereSql}
    ${args.orderBy}
    LIMIT $${args.whereValues.length + 1}
    OFFSET $${args.whereValues.length + 2}
    `,
    [...args.whereValues, args.limit, args.offset],
  );

  return { totalDocs, docs: rowsRes.rows };
}
