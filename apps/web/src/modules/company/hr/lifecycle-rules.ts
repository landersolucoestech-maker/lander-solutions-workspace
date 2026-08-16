const EDITABLE_LEAVE_STATUSES = new Set(["RASCUNHO", "SOLICITADO"]);
const LOCKED_PAYMENT_STATUSES = new Set(["PAGO", "CANCELADO"]);
const CLOSED_CONTRACT_STATUSES = new Set(["ENCERRADO", "CANCELADO"]);

export function canEditLeave(status: string) {
  return EDITABLE_LEAVE_STATUSES.has(status);
}

export function canEditPayment(status: string) {
  return !LOCKED_PAYMENT_STATUSES.has(status);
}

export function canCloseContract(status: string) {
  return !CLOSED_CONTRACT_STATUSES.has(status);
}

export function competenceMonthToDate(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("Competência inválida.");
  }
  return `${value}-01`;
}
