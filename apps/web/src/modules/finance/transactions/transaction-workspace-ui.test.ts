import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const topbar = read("src/app/navigation/topbar.tsx");
const workspace = read("src/modules/finance/transactions/transaction-workspace-page.tsx");
const editor = read("src/modules/finance/transactions/transaction-editor-dialog.tsx");
const connection = read("src/modules/finance/transactions/bank-connection-dialog.tsx");
const providers = read("src/modules/finance/transactions/bank-connection-providers.ts");

describe("transaction workspace correction", () => {
  it("opens the shared transaction editor directly without a nature menu", () => {
    const transactionActions = topbar.slice(
      topbar.indexOf("{isTransactions &&"),
      topbar.indexOf("\n      )}", topbar.indexOf("{isTransactions &&")),
    );
    expect(transactionActions).toContain('dispatchPageEvent("transactions:new")');
    expect(transactionActions).toContain("Nova transação");
    expect(transactionActions).not.toContain("Nova receita");
    expect(transactionActions).not.toContain("Nova despesa");
    expect(workspace).toContain('window.addEventListener("transactions:new"');
    expect(workspace).not.toContain("transactions:new-receivable");
    expect(workspace).not.toContain("transactions:new-payable");
  });

  it("removes the manual document-number field while preserving the required database owner", () => {
    expect(editor).not.toContain("Número ou referência");
    expect(editor).not.toContain("setNumber");
    expect(editor).toContain("manualDocumentNumber(issueDate)");
    expect(editor).toContain("document?.document_number");
    expect(editor).toContain("sm:grid-cols-2");
    expect(editor).not.toContain("sm:grid-cols-3");
  });

  it("uses the exact two-column field order and removes manual external references", () => {
    const identification = editor.slice(
      editor.indexOf('<Section title="Tipo e identificação">'),
      editor.indexOf('<Section title="Classificação operacional">'),
    );
    expect(identification.indexOf('label="Tipo de transação"')).toBeLessThan(
      identification.indexOf('label="Descrição"'),
    );

    const datesAndValue = editor.slice(
      editor.indexOf('<Section title="Datas e valor">'),
      editor.indexOf('<Section title="Informações complementares">'),
    );
    expect(datesAndValue.indexOf('label="Emissão"')).toBeLessThan(
      datesAndValue.indexOf('label="Competência"'),
    );
    expect(datesAndValue.indexOf('label="Vencimento"')).toBeLessThan(
      datesAndValue.indexOf('label="Moeda"'),
    );
    expect(datesAndValue.indexOf('label="Moeda"')).toBeLessThan(
      datesAndValue.indexOf('label="Valor"'),
    );
    expect(editor).not.toContain("externalReference");
    expect(editor).not.toContain("Referência externa");
    expect(editor).toContain('htmlFor="transaction-notes"');
  });

  it("uses account cards as filters and turns view-all into clear plus revalidation", () => {
    expect(workspace).toContain('setSelectedAccountId("all")');
    expect(workspace).toContain("await refresh()");
    expect(workspace).toContain("onClick={() => void showAllAccounts()}");
    expect(workspace).not.toContain("setAllAccountsOpen");
    expect(workspace).not.toContain("<AccountsDirectoryDialog");
    expect(workspace).toContain("Saldo atual cadastrado");
    expect(workspace).toContain("movimentação(ões) nos filtros atuais");
  });

  it("keeps real transaction rows visible when organizational labels are protected", () => {
    expect(workspace).toContain("transactionUnitForRow(");
    expect(workspace).toContain('name: unit?.name ?? "Unidade vinculada — detalhes protegidos"');
    expect(workspace).not.toContain("if (!businessUnit) return []");
  });

  it("renders the existing view modal as an operational summary without highlighted ids", () => {
    const view = workspace.slice(
      workspace.indexOf("function TransactionDetailsDialog"),
      workspace.indexOf("function BankLineEditorDialog"),
    );
    expect(view).toContain("transactionKind(row.expense, row.revenue)");
    expect(view).toContain('<ViewSection title="Identificação">');
    expect(view).toContain('<ViewSection title="Datas">');
    expect(view).toContain('<ViewSection title="Pagamento / liquidação">');
    expect(view).toContain("Ainda não liquidada");
    expect(view).toContain("settlementStatusLabel(settlement.status)");
    expect(view).toContain("Origem técnica");
    expect(view).toContain('row.unitCode === "—"');
    expect(view).not.toContain("row.document.id");
    expect(view).not.toContain("row.bankLine.id");
    expect(view).not.toContain("row.documentNumber");
    expect(view).not.toContain("Detalhes da transação");
  });

  it("keeps bank connection honest and ready for an external OAuth provider", () => {
    expect(workspace).toContain("<BankConnectionDialog");
    expect(connection).toContain("BANK_CONNECTION_PROVIDERS.map");
    expect(connection).toContain("Integração ainda não configurada");
    expect(connection).toContain("redirecionamento OAuth externo");
    expect(providers).toContain('authentication: "oauth_redirect"');
    expect(`${connection}\n${providers}`).not.toMatch(
      /senha bancária|senha do internet banking|token bancário.*value|integration_status:\s*"connected"/i,
    );
  });
});
