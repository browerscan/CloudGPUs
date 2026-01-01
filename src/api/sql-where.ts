import type { WhereOp } from "./query.js";

type AllowedField = {
  field: string;
  column: string;
  cast?: "uuid" | "numeric" | "boolean";
};

const OPS: Record<WhereOp, string> = {
  equals: "=",
  less_than: "<",
};

/**
 * UUID regex pattern for validation (RFC 4122)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildWhereClause(args: {
  allowed: AllowedField[];
  where: { field: string; op: WhereOp; value: string }[];
}) {
  const fieldMap = new Map(args.allowed.map((f) => [f.field, f]));
  const conditions: string[] = [];
  const values: unknown[] = [];

  for (const w of args.where) {
    const allowed = fieldMap.get(w.field);
    if (!allowed) continue;
    const op = OPS[w.op];

    values.push(castValue(w.value, allowed.cast));
    const idx = values.length;
    const col = allowed.column;
    conditions.push(`${col} ${op} $${idx}`);
  }

  const sql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql, values };
}

function castValue(value: string, cast?: AllowedField["cast"]): unknown {
  if (!cast) return value;
  if (cast === "uuid") {
    // Validate UUID format before passing to PostgreSQL
    if (!UUID_REGEX.test(value)) {
      throw new Error(`Invalid UUID format: ${value}`);
    }
    return value;
  }
  if (cast === "numeric") {
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new Error(`Invalid numeric value: ${value}`);
    }
    return num;
  }
  if (cast === "boolean") return value === "true";
  return value;
}
