import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ from: mocks.from, functions: { invoke: mocks.invoke } }),
}));

import {
  closeLegalMatter,
  createLegalEvent,
  createLegalMatter,
  linkLegalMatterToIntellectualProperty,
  listLegalWorkspace,
  updateLegalMatter,
} from "./api";

describe("Legal domain API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists Legal-owned data and only the references required by the page", async () => {
    mocks.from.mockImplementation(() => ({
      select: (columns: string) => ({
        order: async () => ({ data: [], error: null, columns }),
      }),
    }));

    const result = await listLegalWorkspace();
    const queriedTables = mocks.from.mock.calls.map(([table]) => table);

    expect(queriedTables).toEqual([
      "legal_matters",
      "legal_matter_events",
      "legal_matter_intellectual_property_assets",
      "intellectual_property_assets",
      "legal_entities",
      "business_units",
      "projects",
      "parties",
      "contracts",
      "profiles",
      "currencies",
    ]);
    expect(queriedTables).not.toEqual(
      expect.arrayContaining([
        "corporate_assets",
        "asset_events",
        "intellectual_property_events",
        "compliance_obligations",
        "compliance_occurrences",
        "corporate_policies",
        "corporate_policy_versions",
      ]),
    );
    expect(result.legalMatters).toEqual([]);
    expect(result.legalEvents).toEqual([]);
  });

  it("creates and updates a legal matter with optimistic concurrency", async () => {
    const createValues = { code: "JUR-1", title: "Assunto" };
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "matter-1", ...createValues }, error: null }),
      }),
    }));
    mocks.from.mockReturnValueOnce({ insert });
    await expect(createLegalMatter(createValues)).resolves.toMatchObject(createValues);

    const maybeSingle = vi.fn(async () => ({ data: { id: "matter-1", version: 2 }, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    mocks.from.mockReturnValueOnce({ update });

    await expect(updateLegalMatter("matter-1", 1, { title: "Atualizado" })).resolves.toMatchObject({
      version: 2,
    });
    expect(firstEq).toHaveBeenCalledWith("id", "matter-1");
    expect(secondEq).toHaveBeenCalledWith("version", 1);
  });

  it("creates legal events in the Legal event ledger", async () => {
    const values = { legal_matter_id: "matter-1", title: "Audiência" };
    const insert = vi.fn(() => ({
      select: () => ({ single: async () => ({ data: { id: "event-1", ...values }, error: null }) }),
    }));
    mocks.from.mockReturnValue({ insert });

    await expect(createLegalEvent(values)).resolves.toMatchObject(values);
    expect(mocks.from).toHaveBeenCalledWith("legal_matter_events");
  });

  it("preserves the contextual link to the canonical IP master", async () => {
    const values = {
      legal_matter_id: "matter-1",
      intellectual_property_asset_id: "ip-1",
      relationship_type: "conflict",
    };
    const insert = vi.fn(() => ({
      select: () => ({ single: async () => ({ data: values, error: null }) }),
    }));
    mocks.from.mockReturnValue({ insert });

    await expect(linkLegalMatterToIntellectualProperty(values)).resolves.toEqual(values);
    expect(mocks.from).toHaveBeenCalledWith("legal_matter_intellectual_property_assets");
  });

  it("routes closure exclusively through admin-legal", async () => {
    mocks.invoke.mockResolvedValue({ data: { result: { status: "closed" } }, error: null });

    await closeLegalMatter("00000000-0000-4000-8000-000000000001", 2, "Acordo firmado");
    expect(mocks.invoke).toHaveBeenCalledWith("admin-legal", {
      body: {
        action: "close-legal-matter",
        matterId: "00000000-0000-4000-8000-000000000001",
        expectedVersion: 2,
        outcome: "Acordo firmado",
      },
    });
  });
});
