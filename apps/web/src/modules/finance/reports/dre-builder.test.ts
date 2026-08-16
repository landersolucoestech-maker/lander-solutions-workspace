import { describe, expect, it } from "vitest";
import { buildDreRows } from "./dre-builder";

describe("DRE detail reconciliation", () => {
  it("builds real detail from the same posted journal sources used by the dashboard", () => {
    const rows = buildDreRows({
      filters: { period: "2026-08", unitCode: "TODAS" },
      businessUnits: [{ id: "unit-1", code: "CORP" }],
      accounts: [
        {
          id: "revenue",
          code: "3.1",
          name: "Receita",
          account_type: "revenue",
          normal_balance: "credit",
        },
        {
          id: "deduction",
          code: "3.2",
          name: "Dedução",
          account_type: "deduction",
          normal_balance: "debit",
        },
        {
          id: "expense",
          code: "4.1",
          name: "Despesa",
          account_type: "expense",
          normal_balance: "debit",
        },
      ],
      journalEntries: [
        { id: "posted", competence_date: "2026-08-10", status: "posted" },
        { id: "draft", competence_date: "2026-08-10", status: "draft" },
      ],
      journalLines: [
        {
          journal_entry_id: "posted",
          managerial_account_id: "revenue",
          business_unit_id: "unit-1",
          debit_amount: 0,
          credit_amount: 1000,
        },
        {
          journal_entry_id: "posted",
          managerial_account_id: "deduction",
          business_unit_id: "unit-1",
          debit_amount: 100,
          credit_amount: 0,
        },
        {
          journal_entry_id: "posted",
          managerial_account_id: "expense",
          business_unit_id: "unit-1",
          debit_amount: 300,
          credit_amount: 0,
        },
        {
          journal_entry_id: "draft",
          managerial_account_id: "revenue",
          business_unit_id: "unit-1",
          debit_amount: 0,
          credit_amount: 9999,
        },
      ],
    });

    expect(rows.map((row) => [row.accountType, row.amount])).toEqual([
      ["revenue", 1000],
      ["deduction", 100],
      ["expense", 300],
    ]);
    expect(
      rows.reduce(
        (total, row) => total + (row.accountType === "revenue" ? row.amount : -row.amount),
        0,
      ),
    ).toBe(600);
    expect(
      rows.filter((row) => row.accountType === "revenue").reduce((sum, row) => sum + row.amount, 0),
    ).toBe(1000);
    expect(
      rows
        .filter((row) => ["deduction", "expense"].includes(row.accountType))
        .reduce((sum, row) => sum + row.amount, 0),
    ).toBe(400);
  });

  it("keeps a real posting without P&L classification visible as unclassified", () => {
    const rows = buildDreRows({
      filters: { period: "2026-08", unitCode: "TODAS" },
      businessUnits: [],
      accounts: [
        {
          id: "missing-classification",
          code: "9.9",
          name: "Conta pendente de classificação",
          account_type: null,
          normal_balance: "debit",
        },
      ],
      journalEntries: [{ id: "entry", competence_date: "2026-08-20", status: "posted" }],
      journalLines: [
        {
          journal_entry_id: "entry",
          managerial_account_id: "missing-classification",
          business_unit_id: null,
          debit_amount: 275,
          credit_amount: 0,
        },
      ],
    });

    expect(rows).toEqual([
      {
        accountCode: "9.9",
        accountName: "Conta pendente de classificação",
        accountType: "unclassified",
        amount: 275,
      },
    ]);
  });

  it("respects business unit and competence filters", () => {
    const rows = buildDreRows({
      filters: { period: "2026-08", unitCode: "A" },
      businessUnits: [
        { id: "a", code: "A" },
        { id: "b", code: "B" },
      ],
      accounts: [
        {
          id: "r",
          code: "3.1",
          name: "Receita",
          account_type: "revenue",
          normal_balance: "credit",
        },
      ],
      journalEntries: [{ id: "entry", competence_date: "2026-08-01", status: "posted" }],
      journalLines: [
        {
          journal_entry_id: "entry",
          managerial_account_id: "r",
          business_unit_id: "a",
          debit_amount: 0,
          credit_amount: 20,
        },
        {
          journal_entry_id: "entry",
          managerial_account_id: "r",
          business_unit_id: "b",
          debit_amount: 0,
          credit_amount: 30,
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(20);
  });
});
