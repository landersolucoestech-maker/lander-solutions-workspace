import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Compliance and Policies ownership boundary", () => {
  it("uses its canonical API and Edge Function without governance-registry", () => {
    const api = read("src/modules/governance/compliance/api.ts");
    const page = read("src/modules/governance/compliance/compliance-policies-page.tsx");
    expect(api).not.toContain("governance-registry");
    expect(page).not.toContain("governance-registry");
    expect(api).not.toContain("admin-governance");
    expect(api).toContain('functions.invoke("admin-compliance"');
  });

  it("loads only owned collections and references consumed by the page", () => {
    const api = read("src/modules/governance/compliance/api.ts");
    for (const owned of [
      "compliance_obligations",
      "compliance_occurrences",
      "corporate_policies",
      "corporate_policy_versions",
    ]) {
      expect(api).toContain(owned);
    }
    for (const unused of [
      "corporate_assets",
      "asset_events",
      "legal_matters",
      "legal_matter_events",
      "intellectual_property_events",
      'rows("service_lines"',
      'rows("contracts"',
    ]) {
      expect(api).not.toContain(unused);
    }
  });

  it("preserves separate Compliance and Policies workflow permissions", () => {
    const edge = read("../../supabase/functions/admin-compliance/index.ts");
    expect(edge).toContain('"complete-occurrence": "compliance.complete"');
    expect(edge).toContain('"waive-occurrence": "compliance.waive"');
    expect(edge).toContain('"submit-policy-version": "policies.manage"');
    expect(edge).toContain('"approve-policy-version": "policies.approve"');
    expect(edge).toContain('"publish-policy-version": "policies.publish"');
  });
});
