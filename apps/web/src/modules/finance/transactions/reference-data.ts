import {
  listOrganizationalReferenceData,
  type OrganizationalReferenceData,
} from "@/modules/company/organizational-structure/reference-data-api";
import {
  listFinancialReferenceData,
  type FinancialReferenceData,
} from "@/modules/finance/reference-data-api";

export type TransactionReferenceData = OrganizationalReferenceData & FinancialReferenceData;

export async function listTransactionReferenceData(): Promise<TransactionReferenceData> {
  const [organization, finance] = await Promise.all([
    listOrganizationalReferenceData(),
    listFinancialReferenceData(),
  ]);
  return { ...organization, ...finance };
}
