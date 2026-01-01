import type { Request, Response } from "express";
import type { Pool } from "pg";
import { toPaginatedResponse } from "../pagination.js";
import { parsePagination, parseSort, parseWhere } from "../query.js";
import { buildWhereClause } from "../sql-where.js";
import { listInstances } from "../repositories/instances.js";

// Allowlist of valid region codes to prevent injection
const ALLOWED_REGIONS = new Set([
  "us-east",
  "us-east-1",
  "us-east-2",
  "us-west",
  "us-west-1",
  "us-west-2",
  "us-central",
  "eu-central",
  "eu-central-1",
  "eu-west",
  "eu-west-1",
  "eu-west-2",
  "eu-north",
  "eu-north-1",
  "eu-south",
  "eu-south-1",
  "ap-east",
  "ap-east-1",
  "ap-south",
  "ap-south-1",
  "ap-southeast",
  "ap-southeast-1",
  "ap-northeast",
  "ap-northeast-1",
  "ap-northeast-2",
  "ca-central",
  "ca-central-1",
  "sa-east",
  "sa-east-1",
  "me-south",
  "me-south-1",
  "af-south",
  "af-south-1",
  "asia-east",
  "asia-east-1",
  "asia-south",
  "asia-south-1",
  "asia-southeast",
  "asia-southeast-1",
  "australia-southeast",
  "australia-southeast-1",
]);

function isValidRegion(region: string): boolean {
  // Region must be alphanumeric with hyphens only, max 30 chars
  if (!/^[a-z0-9-]{1,30}$/i.test(region)) return false;
  return ALLOWED_REGIONS.has(region.toLowerCase());
}

const allowedWhere = [
  { field: "provider_id", column: "i.provider_id", cast: "uuid" as const },
  { field: "gpu_model_id", column: "i.gpu_model_id", cast: "uuid" as const },
  { field: "availability_status", column: "i.availability_status" },
  { field: "price_per_gpu_hour", column: "i.price_per_gpu_hour", cast: "numeric" as const },
  { field: "is_active", column: "i.is_active", cast: "boolean" as const },
];

const sortable = new Map<string, string>([
  ["price_per_gpu_hour", "i.price_per_gpu_hour"],
  ["last_scraped_at", "i.last_scraped_at"],
  ["updated_at", "i.updated_at"],
]);

export function listInstancesHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { limit, page, offset } = parsePagination(req.query);
    const where = parseWhere(req.query);
    const sort = parseSort(req.query);
    const depth = typeof req.query["depth"] === "string" ? Number(req.query["depth"]) : 0;
    const region = typeof req.query["region"] === "string" ? req.query["region"].trim() : null;

    const { sql: whereSql, values: whereValues } = buildWhereClause({
      allowed: allowedWhere,
      where,
    });

    let finalWhereSql = whereSql;
    const finalWhereValues = [...whereValues];

    if (region) {
      // Validate region before using in SQL query
      if (!isValidRegion(region)) {
        res.status(400).json({
          status: 400,
          error: "bad_request",
          message: "Invalid region parameter",
          timestamp: new Date().toISOString(),
        });
        return;
      }
      finalWhereValues.push(region.toLowerCase());
      const idx = finalWhereValues.length;
      finalWhereSql = finalWhereSql
        ? `${finalWhereSql} AND i.available_regions @> ARRAY[$${idx}]::text[]`
        : `WHERE i.available_regions @> ARRAY[$${idx}]::text[]`;
    }

    const orderBy = (() => {
      if (!sort) return "ORDER BY i.price_per_gpu_hour ASC NULLS LAST";
      const col = sortable.get(sort.field);
      if (!col) return "ORDER BY i.price_per_gpu_hour ASC NULLS LAST";
      return `ORDER BY ${col} ${sort.direction}`;
    })();

    const result = await listInstances({
      pool,
      whereSql: finalWhereSql,
      whereValues: finalWhereValues,
      limit,
      offset,
      orderBy,
      depth: Number.isFinite(depth) ? Math.max(0, Math.min(2, depth)) : 0,
    });

    res.json(toPaginatedResponse({ docs: result.docs, totalDocs: result.totalDocs, limit, page }));
  };
}
