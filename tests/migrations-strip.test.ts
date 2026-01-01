import { describe, expect, it } from "vitest";
import { stripPsqlMetaCommands } from "../src/db/migrations.js";

describe("stripPsqlMetaCommands", () => {
  it("removes psql meta commands", () => {
    const input = "\\echo 'hi'\nSELECT 1;\n\\timing on\nSELECT 2;";
    const out = stripPsqlMetaCommands(input);
    expect(out).toContain("SELECT 1;");
    expect(out).toContain("SELECT 2;");
    expect(out).not.toContain("\\echo");
    expect(out).not.toContain("\\timing");
  });
});
