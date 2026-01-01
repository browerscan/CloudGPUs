import { describe, expect, it } from "vitest";
import { normalizeGpuSlug, normalizeProviderSlug } from "../../src/api/aliases.js";
import { toPaginatedResponse } from "../../src/api/pagination.js";
import { parsePagination, parseSort, parseWhere } from "../../src/api/query.js";
import { buildWhereClause } from "../../src/api/sql-where.js";

describe("api utils", () => {
  it("normalizes known slug aliases", () => {
    expect(normalizeProviderSlug("google-cloud")).toBe("gcp");
    expect(normalizeProviderSlug("latitude")).toBe("latitude-sh");
    expect(normalizeProviderSlug("runpod")).toBe("runpod");

    expect(normalizeGpuSlug("h100")).toBe("h100-sxm");
    expect(normalizeGpuSlug("gb200")).toBe("gb200-nvl");
    expect(normalizeGpuSlug("rtx-4090")).toBe("rtx-4090");
  });

  it("parses pagination, where, and sort", () => {
    expect(parsePagination({})).toEqual({ limit: 50, page: 1, offset: 0 });
    expect(parsePagination({ limit: "10", page: "2" })).toEqual({ limit: 10, page: 2, offset: 10 });

    expect(parseSort({})).toBe(null);
    expect(parseSort({ sort: "name" })).toEqual({ field: "name", direction: "ASC" });
    expect(parseSort({ sort: "-updated_at" })).toEqual({ field: "updated_at", direction: "DESC" });

    expect(
      parseWhere({
        "where[id][equals]": "00000000-0000-0000-0000-000000000001",
        "where[price_per_gpu_hour][less_than]": "2.5",
        "where[bad][gt]": "nope",
        limit: "10",
      }),
    ).toEqual([
      { field: "id", op: "equals", value: "00000000-0000-0000-0000-000000000001" },
      { field: "price_per_gpu_hour", op: "less_than", value: "2.5" },
    ]);
  });

  it("builds WHERE clauses with casts and parameter indices", () => {
    const { sql, values } = buildWhereClause({
      allowed: [
        { field: "id", column: "i.id", cast: "uuid" },
        { field: "is_active", column: "i.is_active", cast: "boolean" },
        { field: "price", column: "i.price", cast: "numeric" },
      ],
      where: [
        { field: "id", op: "equals", value: "00000000-0000-0000-0000-000000000002" },
        { field: "is_active", op: "equals", value: "true" },
        { field: "price", op: "less_than", value: "3.14" },
        // ignored
        { field: "unknown", op: "equals", value: "x" },
      ],
    });

    expect(sql).toBe("WHERE i.id = $1 AND i.is_active = $2 AND i.price < $3");
    expect(values).toEqual(["00000000-0000-0000-0000-000000000002", true, 3.14]);
  });

  it("returns Payload-style paginated responses", () => {
    const res = toPaginatedResponse({ docs: ["a", "b"], totalDocs: 2, limit: 1, page: 99 });
    expect(res.totalPages).toBe(2);
    // clamped to last page
    expect(res.page).toBe(2);
    expect(res.hasPrevPage).toBe(true);
    expect(res.hasNextPage).toBe(false);
    expect(res.prevPage).toBe(1);
    expect(res.nextPage).toBe(null);
  });
});
