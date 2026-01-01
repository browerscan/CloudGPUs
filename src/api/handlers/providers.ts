import type { Request, Response } from "express";
import type { Pool } from "pg";
import { toPaginatedResponse } from "../pagination.js";
import { parsePagination, parseSort, parseWhere } from "../query.js";
import { buildWhereClause } from "../sql-where.js";
import { getProviderBySlug, listProviders } from "../repositories/providers.js";
import { normalizeProviderSlug } from "../aliases.js";

const allowedWhere = [
  { field: "id", column: "id", cast: "uuid" as const },
  { field: "slug", column: "slug" },
  { field: "provider_type", column: "provider_type" },
  { field: "reliability_tier", column: "reliability_tier" },
];

const sortable = new Map<string, string>([
  ["name", "name"],
  ["slug", "slug"],
  ["reliability_tier", "reliability_tier"],
  ["updated_at", "updated_at"],
  ["last_price_update", "last_price_update"],
]);

export function listProvidersHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { limit, page, offset } = parsePagination(req.query);
    const where = parseWhere(req.query);
    const sort = parseSort(req.query);

    const { sql: whereSql, values: whereValues } = buildWhereClause({
      allowed: allowedWhere,
      where,
    });

    const orderBy = (() => {
      if (!sort) return "ORDER BY name ASC";
      const col = sortable.get(sort.field);
      if (!col) return "ORDER BY name ASC";
      return `ORDER BY ${col} ${sort.direction}`;
    })();

    const result = await listProviders({
      pool,
      whereSql,
      whereValues,
      limit,
      offset,
      orderBy,
    });

    res.json(toPaginatedResponse({ docs: result.docs, totalDocs: result.totalDocs, limit, page }));
  };
}

export function getProviderHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Missing provider slug",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const provider = await getProviderBySlug(pool, normalizeProviderSlug(slug));
    if (!provider) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "Provider not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json(provider);
  };
}
