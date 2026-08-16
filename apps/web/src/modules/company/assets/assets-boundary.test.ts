import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function runtimeFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const absolute = join(path, name);
    if (statSync(absolute).isDirectory()) return runtimeFiles(absolute);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [absolute] : [];
  });
}

describe("Assets ownership boundary", () => {
  it("has zero runtime imports from governance-registry", () => {
    const assetsRoot = join(root, "src/modules/company/assets");
    for (const file of runtimeFiles(assetsRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toContain("governance-registry");
    }
  });

  it("keeps Legal, Compliance and IP out of the Assets API", () => {
    const api = read("src/modules/company/assets/api.ts");
    for (const forbidden of [
      "legal_matters",
      "legal_matter_events",
      "intellectual_property_assets",
      "intellectual_property_events",
      "compliance_obligations",
      "compliance_occurrences",
      "corporate_policies",
      "corporate_policy_versions",
      "admin-governance",
    ]) {
      expect(api).not.toContain(forbidden);
    }
  });

  it("makes admin-assets the canonical Edge owner without broadening its scope", () => {
    const edge = read("../../supabase/functions/admin-assets/index.ts");
    expect(edge).toContain('"submit-asset-event": "assets.manage"');
    expect(edge).toContain('"approve-asset-event": "assets.approve"');
    expect(edge).toContain('"apply-asset-event": "assets.apply"');
    expect(edge).toContain('rpcName = "admin_submit_asset_event"');
    expect(edge).toContain('rpcName = "admin_decide_asset_event"');
    expect(edge).toContain('rpcName = "admin_apply_asset_event"');
    expect(edge).not.toContain("legal_matters");
    expect(edge).not.toContain("intellectual_property");
    expect(edge).not.toContain("compliance_");
  });

  it("keeps HR as a read-only consumer of canonical equipment", () => {
    const hrApi = read("src/modules/company/hr/api.ts");
    expect(hrApi).toContain('.from("corporate_assets")');
    expect(hrApi).toContain('.eq("asset_category", "equipment")');
    expect(hrApi).toContain('.from("asset_assignments")');
    expect(hrApi).not.toContain("features/assets");
    expect(hrApi).not.toContain("modules/company/assets");
  });
});
