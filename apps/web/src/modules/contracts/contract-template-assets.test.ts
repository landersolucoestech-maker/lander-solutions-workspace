import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ storage: { from: storage.from } }),
}));

import {
  CONTRACT_TEMPLATE_ASSET_BUCKET,
  buildContractTemplateAssetPath,
  validateContractTemplateImage,
} from "./contract-template-assets";
import {
  createContractTemplateImageUrl,
  removeContractTemplateImages,
  uploadContractTemplateImage,
} from "./api";

function imageFile(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("contract template branding assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.from.mockReturnValue({
      upload: storage.upload,
      remove: storage.remove,
      createSignedUrl: storage.createSignedUrl,
    });
    storage.upload.mockResolvedValue({ data: { path: "ok" }, error: null });
    storage.remove.mockResolvedValue({ data: [], error: null });
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.test/image" },
      error: null,
    });
  });

  it("accepts genuine PNG, JPEG and WebP files", async () => {
    await expect(
      validateContractTemplateImage(
        imageFile([137, 80, 78, 71, 13, 10, 26, 10], "header.png", "image/png"),
      ),
    ).resolves.toBeUndefined();
    await expect(
      validateContractTemplateImage(imageFile([255, 216, 255, 224], "header.jpg", "image/jpeg")),
    ).resolves.toBeUndefined();
    await expect(
      validateContractTemplateImage(
        imageFile([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], "footer.webp", "image/webp"),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects unsupported, oversized, empty and spoofed files", async () => {
    await expect(
      validateContractTemplateImage(imageFile([1], "header.svg", "image/svg+xml")),
    ).rejects.toThrow("PNG, JPEG ou WebP");
    await expect(
      validateContractTemplateImage(new File([], "empty.png", { type: "image/png" })),
    ).rejects.toThrow("vazio");
    await expect(
      validateContractTemplateImage(
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("2 MB");
    await expect(
      validateContractTemplateImage(imageFile([1, 2, 3, 4], "fake.png", "image/png")),
    ).rejects.toThrow("não corresponde");
  });

  it("builds a safe development path for each template and slot", () => {
    expect(
      buildContractTemplateAssetPath(
        "00000000-0000-4000-8000-000000000001",
        "header",
        "image/png",
        "00000000-0000-4000-8000-000000000002",
      ),
    ).toBe(
      "public-dev/contract-templates/00000000-0000-4000-8000-000000000001/header/00000000-0000-4000-8000-000000000002.png",
    );
  });

  it("uploads without upsert, removes replaced assets and resolves private signed URLs", async () => {
    const file = imageFile([137, 80, 78, 71, 13, 10, 26, 10], "header.png", "image/png");
    const path = await uploadContractTemplateImage(
      "00000000-0000-4000-8000-000000000001",
      "header",
      file,
    );
    expect(storage.from).toHaveBeenCalledWith(CONTRACT_TEMPLATE_ASSET_BUCKET);
    expect(storage.upload).toHaveBeenCalledWith(
      path,
      file,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );

    await removeContractTemplateImages([path, path, null]);
    expect(storage.remove).toHaveBeenCalledWith([path]);
    await expect(createContractTemplateImageUrl(path)).resolves.toBe("https://signed.test/image");
  });
});
