import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(
  join(process.cwd(), "../../supabase/functions/admin-hr/index.ts"),
  "utf8",
);

describe("HR settings mutation boundary", () => {
  it("uses only the caller-scoped database workflow", () => {
    expect(adminSource).toContain('callerClient.rpc("upsert_hr_settings"');
    expect(adminSource).toContain("p_expected_version: expectedVersion");
    expect(adminSource).not.toContain('.from("hr_settings")');
    expect(adminSource).not.toContain("settingsQuery = adminClient");
  });
});
