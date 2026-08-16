import { AUTHENTICATION_ENABLED } from "@/config/authentication";

export const CONTRACT_TEMPLATE_ASSET_BUCKET = "contract-template-assets";
export const CONTRACT_TEMPLATE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const CONTRACT_TEMPLATE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export type ContractTemplateImageSlot = "header" | "footer";

const MIME_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type SupportedMimeType = keyof typeof MIME_EXTENSION;

function hasExpectedSignature(bytes: Uint8Array, mimeType: SupportedMimeType) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function validateContractTemplateImage(file: File): Promise<void> {
  if (!(file.type in MIME_EXTENSION)) {
    throw new Error("Use uma imagem PNG, JPEG ou WebP.");
  }
  if (file.size <= 0) throw new Error("O arquivo de imagem está vazio.");
  if (file.size > CONTRACT_TEMPLATE_IMAGE_MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 2 MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedSignature(bytes, file.type as SupportedMimeType)) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato de imagem informado.");
  }
}

export function buildContractTemplateAssetPath(
  templateId: string,
  slot: ContractTemplateImageSlot,
  mimeType: SupportedMimeType,
  assetId = crypto.randomUUID(),
) {
  const prefix = AUTHENTICATION_ENABLED ? "contract-templates" : "public-dev/contract-templates";
  return `${prefix}/${templateId}/${slot}/${assetId}.${MIME_EXTENSION[mimeType]}`;
}
