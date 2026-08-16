import { describe, expect, it } from "vitest";

import { ASSET_CATEGORY_TYPES, assetClassificationSchema } from "./asset-classification";

describe("canonical asset classification", () => {
  it.each([
    ["equipment", "computer"],
    ["license", "software_license"],
    ["digital_service", "domain"],
    ["insurance", "insurance_policy"],
  ])("accepts %s / %s", (asset_category, asset_type) => {
    expect(assetClassificationSchema.parse({ asset_category, asset_type })).toEqual({
      asset_category,
      asset_type,
    });
  });

  it("keeps HR equipment identifiable by the equipment category", () => {
    expect(ASSET_CATEGORY_TYPES.equipment).toContain("computer");
    expect(ASSET_CATEGORY_TYPES.equipment).toContain("mobile_device");
    expect(ASSET_CATEGORY_TYPES.equipment).toContain("audiovisual_equipment");
  });

  it.each([
    ["equipment", "software_license"],
    ["license", "computer"],
    ["patent", "other"],
    ["other", "trademark"],
  ])("rejects invalid or intellectual classification %s / %s", (asset_category, asset_type) => {
    expect(assetClassificationSchema.safeParse({ asset_category, asset_type }).success).toBe(false);
  });
});
