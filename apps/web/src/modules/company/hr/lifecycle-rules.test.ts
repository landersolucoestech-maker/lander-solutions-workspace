import { describe, expect, it } from "vitest";

import {
  canCloseContract,
  canEditLeave,
  canEditPayment,
  competenceMonthToDate,
} from "./lifecycle-rules";

describe("HR lifecycle rules", () => {
  it("allows leave editing only before a decision", () => {
    expect(canEditLeave("RASCUNHO")).toBe(true);
    expect(canEditLeave("SOLICITADO")).toBe(true);
    expect(canEditLeave("APROVADO")).toBe(false);
    expect(canEditLeave("RECUSADO")).toBe(false);
    expect(canEditLeave("CANCELADO")).toBe(false);
  });

  it("locks paid and cancelled administrative payments", () => {
    expect(canEditPayment("PENDENTE")).toBe(true);
    expect(canEditPayment("AGENDADO")).toBe(true);
    expect(canEditPayment("ATRASADO")).toBe(true);
    expect(canEditPayment("PAGO")).toBe(false);
    expect(canEditPayment("CANCELADO")).toBe(false);
  });

  it("prevents closing a contract twice", () => {
    expect(canCloseContract("RASCUNHO")).toBe(true);
    expect(canCloseContract("ATIVO")).toBe(true);
    expect(canCloseContract("VENCIDO")).toBe(true);
    expect(canCloseContract("ENCERRADO")).toBe(false);
    expect(canCloseContract("CANCELADO")).toBe(false);
  });

  it("normalizes a valid competence month to the first day", () => {
    expect(competenceMonthToDate("2026-08")).toBe("2026-08-01");
  });

  it("rejects malformed competence months", () => {
    expect(() => competenceMonthToDate("2026-13")).toThrow("Competência inválida");
    expect(() => competenceMonthToDate("08/2026")).toThrow("Competência inválida");
  });
});
