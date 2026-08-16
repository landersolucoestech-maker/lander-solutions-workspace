import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Audit ownership boundary", () => {
  it("reads only audit_events behind audit.read", () => {
    const page = read("src/modules/audit/audit-page.tsx");
    const api = read("src/modules/audit/api.ts");
    expect(page).toContain('hasPermission("audit.read")');
    expect(api).toContain('from("audit_events")');
    expect(api).not.toContain(".insert(");
    expect(api).not.toContain(".update(");
    expect(api).not.toContain(".delete(");
  });
});
