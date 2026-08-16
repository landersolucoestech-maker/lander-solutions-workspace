import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ from: mocks.from }),
}));

import { createContractTemplate, listContractTemplates, updateContractTemplate } from "./api";

const branding = {
  header_image_path:
    "public-dev/contract-templates/00000000-0000-4000-8000-000000000001/header/00000000-0000-4000-8000-000000000002.png",
  footer_image_path:
    "public-dev/contract-templates/00000000-0000-4000-8000-000000000001/footer/00000000-0000-4000-8000-000000000003.webp",
  header_image_alignment: "center",
  footer_image_alignment: "right",
};

describe("contract templates API persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists header and footer configuration during creation", async () => {
    const single = vi.fn(async () => ({ data: { id: "template-1", ...branding }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ insert });

    await expect(createContractTemplate(branding)).resolves.toMatchObject(branding);
    expect(mocks.from).toHaveBeenCalledWith("contract_templates");
    expect(insert).toHaveBeenCalledWith(branding);
  });

  it("persists replacement or removal with optimistic concurrency", async () => {
    const values = { ...branding, header_image_path: null };
    const maybeSingle = vi.fn(async () => ({
      data: { id: "template-1", version: 4, ...values },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const versionEq = vi.fn(() => ({ select }));
    const idEq = vi.fn(() => ({ eq: versionEq }));
    const update = vi.fn(() => ({ eq: idEq }));
    mocks.from.mockReturnValue({ update });

    await expect(updateContractTemplate("template-1", 3, values)).resolves.toMatchObject(values);
    expect(update).toHaveBeenCalledWith(values);
    expect(idEq).toHaveBeenCalledWith("id", "template-1");
    expect(versionEq).toHaveBeenCalledWith("version", 3);
  });

  it("loads legacy templates that do not yet have branding values", async () => {
    const order = vi.fn(async () => ({
      data: [{ id: "legacy", header_text: "", footer_text: "" }],
      error: null,
    }));
    const select = vi.fn(() => ({ order }));
    mocks.from.mockReturnValue({ select });

    await expect(listContractTemplates()).resolves.toEqual([
      { id: "legacy", header_text: "", footer_text: "" },
    ]);
  });
});
