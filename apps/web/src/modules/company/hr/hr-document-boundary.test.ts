import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(
  join(process.cwd(), "../../supabase/functions/admin-hr/index.ts"),
  "utf8",
);

describe("HR employee document mutation boundary", () => {
  it("uses caller-scoped workflows for registration and logical deletion", () => {
    expect(adminSource).toContain('callerClient.rpc("register_hr_document"');
    expect(adminSource).toContain('callerClient.rpc("delete_hr_document"');
    expect(adminSource).not.toMatch(/\.from\("employee_documents"\)\s*\.insert/);
    expect(adminSource).not.toMatch(/\.from\("employee_documents"\)\s*\.update/);
  });
});
