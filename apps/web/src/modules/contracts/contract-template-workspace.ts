import type { ContractTemplateVariable } from "@/modules/contracts/types";
import { findContractTemplateVariableDefinition } from "@/modules/contracts/contract-template-variable-registry";

export const CONTRACT_TEMPLATE_VARIABLE_TYPES: ContractTemplateVariable["type"][] = [
  "text",
  "textarea",
  "date",
  "number",
  "currency",
  "percentage",
  "select",
];

export function normalizeVariableKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]/g, "");
}

export function normalizeManifest(value: unknown): ContractTemplateVariable[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const type = CONTRACT_TEMPLATE_VARIABLE_TYPES.includes(
      record.type as ContractTemplateVariable["type"],
    )
      ? (record.type as ContractTemplateVariable["type"])
      : "text";
    const key = typeof record.key === "string" ? normalizeVariableKey(record.key) : "";
    if (!key) return [];
    const definition = findContractTemplateVariableDefinition(key);
    return [
      {
        key,
        label: typeof record.label === "string" ? record.label : key,
        type,
        required: record.required === true,
        group: typeof record.group === "string" ? record.group : "Contrato",
        source:
          typeof record.source === "string" ? record.source : (definition?.source ?? "manual"),
        description:
          typeof record.description === "string"
            ? record.description
            : (definition?.description ?? "Preenchimento manual durante a preparação do contrato."),
        active: record.active !== false,
        ...(Array.isArray(record.options)
          ? {
              options: record.options.filter(
                (option): option is string => typeof option === "string",
              ),
            }
          : {}),
      },
    ];
  });
}

export function normalizeTemplateVariable(
  variable: ContractTemplateVariable,
): ContractTemplateVariable {
  return {
    ...variable,
    key: normalizeVariableKey(variable.key),
    label: variable.label.trim() || variable.key,
    group: variable.group.trim() || "Contrato",
    source: variable.source?.trim() || "manual",
    description:
      variable.description?.trim() || "Preenchimento manual durante a preparação do contrato.",
    active: variable.active !== false,
  };
}

export function extractPlaceholders(value: string) {
  const matches = value.matchAll(/\{\{\s*([A-Z0-9_.-]+)\s*\}\}/gi);
  return [...new Set([...matches].map((match) => normalizeVariableKey(match[1])))].sort();
}

const SIGNATURE_PLACEHOLDER_GROUPS = new Set(["SIGNATURE", "INITIALS", "SIGN_DATE"]);

export function isRolePlaceholder(
  placeholder: string,
  partyRoles: string[],
  signatureRoles: string[],
) {
  const [group, field] = placeholder.split(".");
  if (partyRoles.includes(group)) return true;
  return SIGNATURE_PLACEHOLDER_GROUPS.has(group) && signatureRoles.includes(field);
}

export function findUnresolvedTemplatePlaceholders(
  placeholders: string[],
  manifestKeys: Set<string>,
  partyRoles: string[],
  signatureRoles: string[],
) {
  return placeholders.filter(
    (placeholder) =>
      !manifestKeys.has(placeholder) && !isRolePlaceholder(placeholder, partyRoles, signatureRoles),
  );
}
