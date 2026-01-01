import type { Request, Response } from "express";
import type { Pool } from "pg";
import { toPaginatedResponse } from "../pagination.js";
import { parsePagination, parseSort, parseWhere } from "../query.js";
import { buildWhereClause } from "../sql-where.js";
import { getGpuModelBySlug, listGpuModels } from "../repositories/gpu-models.js";

const allowedWhere = [
  { field: "id", column: "id", cast: "uuid" as const },
  { field: "slug", column: "slug" },
  { field: "architecture", column: "architecture" },
  { field: "vram_gb", column: "vram_gb", cast: "numeric" as const },
];

const sortable = new Map<string, string>([
  ["name", "name"],
  ["slug", "slug"],
  ["vram_gb", "vram_gb"],
  ["updated_at", "updated_at"],
]);

export function listGpuModelsHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { limit, page, offset } = parsePagination(req.query);
    const where = parseWhere(req.query);
    const sort = parseSort(req.query);

    const { sql: whereSql, values: whereValues } = buildWhereClause({
      allowed: allowedWhere,
      where,
    });

    const orderBy = (() => {
      if (!sort) return "ORDER BY vram_gb DESC, name ASC";
      const col = sortable.get(sort.field);
      if (!col) return "ORDER BY vram_gb DESC, name ASC";
      return `ORDER BY ${col} ${sort.direction}`;
    })();

    const result = await listGpuModels({
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

export function getGpuModelHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Missing GPU slug",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const gpu = await getGpuModelBySlug(pool, slug);
    if (!gpu) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "GPU not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json(gpu);
  };
}
