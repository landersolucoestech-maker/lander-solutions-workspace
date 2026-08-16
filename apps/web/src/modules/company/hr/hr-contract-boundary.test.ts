import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(
  join(process.cwd(), "../../supabase/functions/admin-hr/index.ts"),
  "utf8",
);

describe("HR employment contract mutation boundary", () => {
  it("uses caller-scoped workflows for create, update, and close", () => {
    expect(adminSource).toContain('callerClient.rpc("create_hr_contract"');
    expect(adminSource).toContain('callerClient.rpc("update_hr_contract"');
    expect(adminSource).toContain('callerClient.rpc("close_hr_contract"');
    expect(adminSource).not.toMatch(/\.from\("employment_contracts"\)\s*\.insert/);
    expect(adminSource).not.toMatch(/\.from\("employment_contracts"\)\s*\.update/);
  });
});
