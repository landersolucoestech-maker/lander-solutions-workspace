import { z } from "zod";

export const ASSET_CATEGORY_TYPES = {
  equipment: ["equipment", "computer", "mobile_device", "audiovisual_equipment"],
  vehicle: ["vehicle"],
  furniture: ["furniture"],
  license: ["software_license", "digital_certificate"],
  digital_service: ["domain", "subscription_license"],
  insurance: ["insurance_policy"],
  other: ["other"],
} as const;

export type AssetCategory = keyof typeof ASSET_CATEGORY_TYPES;
export type AssetType = (typeof ASSET_CATEGORY_TYPES)[AssetCategory][number];

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  equipment: "Equipamento",
  vehicle: "Veículo",
  furniture: "Mobiliário",
  license: "Licença",
  digital_service: "Licença ou registro digital",
  insurance: "Seguro",
  other: "Outro ativo operacional",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  equipment: "Equipamento geral",
  computer: "Computador",
  mobile_device: "Dispositivo móvel",
  audiovisual_equipment: "Equipamento audiovisual",
  vehicle: "Veículo",
  furniture: "Mobiliário",
  software_license: "Licença de software",
  digital_certificate: "Certificado digital",
  domain: "Domínio de internet",
  subscription_license: "Licença de assinatura administrativa",
  insurance_policy: "Apólice de seguro",
  other: "Outro ativo operacional",
};

const assetCategorySchema = z.enum(
  Object.keys(ASSET_CATEGORY_TYPES) as [AssetCategory, ...AssetCategory[]],
);
const assetTypeSchema = z.enum(Object.keys(ASSET_TYPE_LABELS) as [AssetType, ...AssetType[]]);

export const assetClassificationSchema = z
  .object({ asset_category: assetCategorySchema, asset_type: assetTypeSchema })
  .superRefine(({ asset_category, asset_type }, context) => {
    const allowed = ASSET_CATEGORY_TYPES[asset_category] as readonly AssetType[];
    if (!allowed.includes(asset_type)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["asset_type"],
        message: "O tipo técnico não pertence à categoria selecionada.",
      });
    }
  });

export function assertAssetClassification(values: Record<string, unknown>) {
  assetClassificationSchema.parse({
    asset_category: values.asset_category,
    asset_type: values.asset_type,
  });
}
