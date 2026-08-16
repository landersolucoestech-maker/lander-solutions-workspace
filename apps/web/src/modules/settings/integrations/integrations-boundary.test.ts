import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Integration settings boundary", () => {
  it("owns integration configuration behind its specific permission", () => {
    const api = read("src/modules/settings/integrations/api.ts");
    const edge = read("../../supabase/functions/admin-integrations/index.ts");
    expect(api).toContain('from("integration_connections")');
    expect(api).toContain('p_permission_code: "settings.integrations.manage"');
    expect(api).toContain('functions.invoke("admin-integrations"');
    expect(edge).toContain('p_permission_code: "settings.integrations.manage"');
    expect(edge).toContain('rpc("has_aal2")');
  });
});
