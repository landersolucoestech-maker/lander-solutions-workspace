import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ from: mocks.from, functions: { invoke: mocks.invoke } }),
}));

import { createAsset, listAssetsWorkspace, submitAssetEvent, updateAsset } from "./api";

const classification = { asset_category: "equipment", asset_type: "computer" };

describe("Assets domain API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only Assets-owned data and the references required by the form", async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
    }));

    const result = await listAssetsWorkspace();
    const queriedTables = mocks.from.mock.calls.map(([table]) => table);

    expect(queriedTables).toEqual([
      "corporate_assets",
      "asset_events",
      "legal_entities",
      "business_units",
      "products",
      "service_lines",
      "projects",
      "parties",
      "contracts",
      "financial_documents",
      "profiles",
      "currencies",
    ]);
    expect(queriedTables).not.toEqual(
      expect.arrayContaining([
        "legal_matters",
        "legal_matter_events",
        "intellectual_property_assets",
        "intellectual_property_events",
        "compliance_obligations",
        "compliance_occurrences",
        "corporate_policies",
        "corporate_policy_versions",
      ]),
    );
    expect(result.assets).toEqual([]);
    expect(result.assetEvents).toEqual([]);
  });

  it("creates a valid canonical asset in the Assets master", async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "asset-1", ...classification }, error: null }),
      }),
    }));
    mocks.from.mockReturnValue({ insert });

    await expect(createAsset(classification)).resolves.toMatchObject(classification);
    expect(mocks.from).toHaveBeenCalledWith("corporate_assets");
    expect(insert).toHaveBeenCalledWith(classification);
  });

  it("updates a valid canonical asset with optimistic concurrency", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: "asset-1", version: 3, ...classification },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    mocks.from.mockReturnValue({ update });

    await expect(updateAsset("asset-1", 2, classification)).resolves.toMatchObject({ version: 3 });
    expect(mocks.from).toHaveBeenCalledWith("corporate_assets");
    expect(firstEq).toHaveBeenCalledWith("id", "asset-1");
    expect(secondEq).toHaveBeenCalledWith("version", 2);
  });

  it("routes asset workflow actions through the Assets Edge Function", async () => {
    mocks.invoke.mockResolvedValue({
      data: { result: { status: "pending_approval" } },
      error: null,
    });

    await expect(submitAssetEvent("00000000-0000-4000-8000-000000000001", 1)).resolves.toEqual({
      status: "pending_approval",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("admin-assets", {
      body: {
        action: "submit-asset-event",
        eventId: "00000000-0000-4000-8000-000000000001",
        expectedVersion: 1,
      },
    });
  });
});
