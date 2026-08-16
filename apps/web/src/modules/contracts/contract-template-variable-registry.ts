import type { ContractTemplateVariable } from "@/modules/contracts/types";

export type ContractTemplateVariableDefinition = ContractTemplateVariable & {
  source: string;
  description: string;
  active: boolean;
};

export const CONTRACT_TEMPLATE_VARIABLE_REGISTRY: ContractTemplateVariableDefinition[] = [
  {
    key: "CONTRATO.TITULO",
    label: "Título do contrato",
    group: "Contrato",
    source: "contracts.title",
    type: "text",
    description: "Título informado no cadastro do contrato.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.PRODUTO_SERVICO",
    label: "Produto, serviço ou unidade",
    group: "Contrato",
    source: "products.name / service_lines.name / business_units.name",
    type: "text",
    description: "Nome do produto, serviço ou unidade associado ao contrato.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.PLANO",
    label: "Plano ou referência contratual",
    group: "Contrato",
    source: "contracts.title",
    type: "text",
    description: "Referência definida pelo título do contrato durante a preparação.",
    required: true,
    active: true,
  },
  {
    key: "UNIDADE_NEGOCIO.NOME",
    label: "Nome da unidade de negócio",
    group: "Unidade de Negócio",
    source: "business_units.name",
    type: "text",
    description: "Nome da unidade de negócio selecionada para o contrato.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.DATA_INICIO",
    label: "Data de início",
    group: "Datas",
    source: "contracts.starts_on",
    type: "date",
    description: "Data inicial da vigência contratual.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.DATA_FIM",
    label: "Data de encerramento",
    group: "Datas",
    source: "contracts.ends_on",
    type: "date",
    description: "Data final da vigência, quando definida.",
    required: false,
    active: true,
  },
  {
    key: "CONTRATO.RENOVACAO",
    label: "Regra de renovação",
    group: "Datas",
    source: "contracts.auto_renewal / contracts.renewal_notice_days",
    type: "text",
    description: "Descrição calculada a partir da renovação e do prazo de aviso.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.VALOR",
    label: "Valor contratual",
    group: "Valores",
    source: "contracts.base_amount / contracts.currency_code",
    type: "currency",
    description: "Valor-base formatado na moeda do contrato.",
    required: false,
    active: true,
  },
  {
    key: "CONTRATO.FATURAMENTO",
    label: "Frequência de faturamento",
    group: "Valores",
    source: "contracts.billing_frequency",
    type: "text",
    description: "Periodicidade de faturamento configurada no contrato.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.PRAZO_PAGAMENTO_DIAS",
    label: "Prazo de pagamento em dias",
    group: "Valores",
    source: "contract_versions.payment_term_days",
    type: "number",
    description: "Prazo de pagamento definido para a versão contratual.",
    required: true,
    active: true,
  },
  {
    key: "CONTRATO.OBSERVACOES",
    label: "Observações específicas",
    group: "Contrato",
    source: "contracts.notes",
    type: "textarea",
    description: "Observações registradas no contrato.",
    required: false,
    active: true,
  },
];

export const CONTRACT_TEMPLATE_VARIABLE_GROUPS = [
  ...new Set(CONTRACT_TEMPLATE_VARIABLE_REGISTRY.map((variable) => variable.group)),
];

export function findContractTemplateVariableDefinition(key: string) {
  return CONTRACT_TEMPLATE_VARIABLE_REGISTRY.find((variable) => variable.key === key);
}
