import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  BusinessUnitOption,
  ContractOption,
  PartyOption,
  PayoutObligation,
  PayoutPayment,
  PayoutWorkspace,
  SettlementOption,
} from "./types";

export async function listPayoutWorkspace(): Promise<PayoutWorkspace> {
  const client = getSupabaseBrowserClient();
  const [obligations, payments, contracts, parties, businessUnits] = await Promise.all([
    client.from("payout_obligations").select("*").order("due_date"),
    client.from("payout_payments").select("*").order("paid_on", { ascending: false }),
    client.from("contracts").select("id,code,title,currency_code,status").order("code"),
    client.from("parties").select("id,legal_name,trade_name,status").order("legal_name"),
    client.from("business_units").select("id,code,name,status").order("name"),
  ]);

  const failed = [obligations, payments, contracts, parties, businessUnits].find(
    (result) => result.error,
  );
  if (failed?.error) throw failed.error;

  return {
    obligations: (obligations.data ?? []) as PayoutObligation[],
    payments: (payments.data ?? []) as PayoutPayment[],
    contracts: (contracts.data ?? []) as ContractOption[],
    parties: (parties.data ?? []) as PartyOption[],
    businessUnits: (businessUnits.data ?? []) as BusinessUnitOption[],
  };
}

export async function createPayoutPayment(values: Record<string, unknown>): Promise<PayoutPayment> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from("payout_payments").insert(values).select("*").single();
  if (error) throw error;
  return data as PayoutPayment;
}

async function invokePayout<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-payouts", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function listPayoutSettlements(obligationId: string): Promise<SettlementOption[]> {
  const result = await invokePayout<{ settlements: SettlementOption[] }>({
    action: "list-settlements",
    obligationId,
  });
  return result.settlements;
}

export function postPayoutPayment(paymentId: string, expectedVersion: number) {
  return invokePayout<{ result: PayoutPayment }>({
    action: "post-payment",
    paymentId,
    expectedVersion,
  });
}
