import type { Pool } from "pg";
import type { GpuModel } from "../types.js";

export async function listGpuModels(args: {
  pool: Pool;
  whereSql: string;
  whereValues: unknown[];
  limit: number;
  offset: number;
  orderBy: string;
}) {
  const countRes = await args.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM cloudgpus.gpu_models ${args.whereSql}`,
    args.whereValues,
  );
  const totalDocs = Number(countRes.rows[0]?.count ?? 0);

  const rowsRes = await args.pool.query<GpuModel>(
    `
    SELECT
      id, slug, name, short_name, architecture, vram_gb, memory_type,
      memory_bandwidth_gbps, tdp_watts,
      is_datacenter, is_consumer, generation_year,
      created_at, updated_at
    FROM cloudgpus.gpu_models
    ${args.whereSql}
    ${args.orderBy}
    LIMIT $${args.whereValues.length + 1}
    OFFSET $${args.whereValues.length + 2}
    `,
    [...args.whereValues, args.limit, args.offset],
  );

  return { totalDocs, docs: rowsRes.rows };
}

export async function getGpuModelBySlug(pool: Pool, slug: string) {
  const res = await pool.query<GpuModel>(
    `
    SELECT
      id, slug, name, short_name, architecture, vram_gb, memory_type,
      memory_bandwidth_gbps, tdp_watts,
      is_datacenter, is_consumer, generation_year,
      created_at, updated_at
    FROM cloudgpus.gpu_models
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );
  return res.rows[0] ?? null;
}
