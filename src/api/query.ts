import { z } from "zod";

const limitSchema = z.coerce.number().int().min(1).max(100).default(50);
const pageSchema = z.coerce.number().int().min(1).default(1);

export function parsePagination(query: Record<string, unknown>) {
  const limit = limitSchema.parse(query["limit"]);
  const page = pageSchema.parse(query["page"]);
  return { limit, page, offset: (page - 1) * limit };
}

export type WhereOp = "equals" | "less_than";

export function parseWhere(query: Record<string, unknown>) {
  const where: { field: string; op: WhereOp; value: string }[] = [];

  // Express may parse bracketed keys either as a flat key string
  // (`where[field][equals]=...`) or as a nested object (`where: { field: { equals: ... } }`).
  const nested = query["where"];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [field, ops] of Object.entries(nested as Record<string, unknown>)) {
      if (!ops || typeof ops !== "object" || Array.isArray(ops)) continue;
      for (const [op, rawValue] of Object.entries(ops as Record<string, unknown>)) {
        if (typeof rawValue !== "string") continue;
        if (op !== "equals" && op !== "less_than") continue;
        where.push({ field, op, value: rawValue });
      }
    }
  }

  for (const [key, rawValue] of Object.entries(query)) {
    if (typeof rawValue !== "string") continue;
    const match = /^where\[(.+?)\]\[(.+?)\]$/.exec(key);
    if (!match) continue;
    const field = match[1]!;
    const op = match[2]!;
    if (op !== "equals" && op !== "less_than") continue;
    where.push({ field, op, value: rawValue });
  }
  return where;
}

export function parseSort(query: Record<string, unknown>) {
  const sortRaw = typeof query["sort"] === "string" ? query["sort"] : undefined;
  if (!sortRaw) return null;
  const desc = sortRaw.startsWith("-");
  const field = desc ? sortRaw.slice(1) : sortRaw;
  return { field, direction: desc ? ("DESC" as const) : ("ASC" as const) };
}
