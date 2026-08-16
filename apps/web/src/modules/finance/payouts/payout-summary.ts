import type { PayoutObligation } from "./types";

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizePayoutObligations(obligations: PayoutObligation[], today: string) {
  const valid = obligations.filter((item) => !["cancelled", "reversed"].includes(item.status));
  const due = valid.reduce((sum, item) => sum + numeric(item.amount), 0);
  const paid = valid.reduce((sum, item) => sum + numeric(item.paid_amount), 0);
  const pending = valid.reduce(
    (sum, item) => sum + Math.max(0, numeric(item.amount) - numeric(item.paid_amount)),
    0,
  );
  const overdue = valid
    .filter((item) => item.status !== "paid" && item.due_date < today)
    .reduce((sum, item) => sum + Math.max(0, numeric(item.amount) - numeric(item.paid_amount)), 0);
  return { due, paid, pending, overdue };
}
