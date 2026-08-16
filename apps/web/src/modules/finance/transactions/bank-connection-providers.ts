export type BankConnectionAvailability = "available" | "configuration_required";

export type BankConnectionProvider = {
  id: string;
  name: string;
  description: string;
  authentication: "oauth_redirect";
  capabilities: readonly string[];
  availability: BankConnectionAvailability;
};

/**
 * Catálogo único da experiência bancária. Nenhuma entrada deve ser marcada como
 * disponível antes de existir backend, callback OAuth e configuração segura.
 */
export const BANK_CONNECTION_PROVIDERS: readonly BankConnectionProvider[] = [
  {
    id: "open-finance-oauth",
    name: "Open Finance / OAuth",
    description:
      "Canal seguro para conectar instituições por redirecionamento ao provedor homologado.",
    authentication: "oauth_redirect",
    capabilities: ["Contas", "Saldos", "Transações"],
    availability: "configuration_required",
  },
];
