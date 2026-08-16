import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Legal ownership boundary", () => {
  it("keeps the active Legal runtime independent from governance-registry", () => {
    for (const path of [
      "src/modules/governance/legal/api.ts",
      "src/modules/governance/legal/types.ts",
      "src/modules/governance/legal/legal-page.tsx",
      "src/modules/governance/legal/index.ts",
    ]) {
      const source = read(path);
      expect(source, path).not.toContain("governance-registry");
      expect(source, path).not.toContain("admin-governance");
    }
    expect(read("src/modules/governance/legal/api.ts")).toContain('functions.invoke("admin-legal"');
  });

  it("does not load complete Assets, Compliance, Policies or IP events", () => {
    const api = read("src/modules/governance/legal/api.ts");
    for (const forbidden of [
      "corporate_assets",
      "asset_events",
      "intellectual_property_events",
      "compliance_obligations",
      "compliance_occurrences",
      "corporate_policies",
      "corporate_policy_versions",
    ]) {
      expect(api).not.toContain(forbidden);
    }
    expect(api).toContain('rows("intellectual_property_assets", "id,code,title,status", "code")');
  });

  it("removes the unreachable legal-compliance legacy implementation", () => {
    const route = read("src/routes/juridico.tsx");
    const index = read("src/modules/governance/legal/index.ts");
    expect(route).toContain("LegalPage");
    expect(route).not.toContain("LegalCompliancePage");
    expect(index).not.toContain("LegalCompliancePage");
    expect(existsSync(join(process.cwd(), "src/features/legal/legal-compliance-page.tsx"))).toBe(
      false,
    );
  });

  it("preserves Legal permissions without absorbing IP authorization", () => {
    const edge = read("../../supabase/functions/admin-legal/index.ts");
    const api = read("src/modules/governance/legal/api.ts");
    expect(edge).toContain('p_permission_code: "legal.close"');
    expect(edge).not.toContain("ip.read");
    expect(edge).not.toContain("ip.manage");
    expect(edge).not.toContain("ip.approve");
    expect(api).not.toContain("ip.read");
    expect(api).not.toContain("ip.manage");
    expect(api).not.toContain("ip.approve");
  });
});
