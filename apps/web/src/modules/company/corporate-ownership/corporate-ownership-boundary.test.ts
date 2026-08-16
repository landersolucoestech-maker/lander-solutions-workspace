import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Corporate ownership boundary", () => {
  it("uses only corporate ownership workflow permissions", () => {
    const page = read("src/modules/company/corporate-ownership/corporate-ownership-page.tsx");
    for (const permission of ["read", "manage", "apply_changes"]) {
      expect(page).toContain(`hasPermission("corporate_ownership.${permission}")`);
    }
    expect(page).not.toContain("organizational_structure.manage");
  });

  it("owns corporate ledgers without reusing operational positions", () => {
    const api = read("src/modules/company/corporate-ownership/api.ts");
    expect(api).toContain('from("corporate_ownership_positions")');
    expect(api).toContain('from("corporate_ownership_roles")');
    expect(api).not.toContain('from("positions")');
    expect(api).not.toContain('from("departments")');
  });

  it("has one internal API instead of a governance API split", () => {
    const page = read("src/modules/company/corporate-ownership/corporate-ownership-page.tsx");
    const dialogs = read("src/modules/company/corporate-ownership/corporate-ownership-dialogs.tsx");
    expect(`${page}\n${dialogs}`).not.toContain("governance-api");
  });
});
