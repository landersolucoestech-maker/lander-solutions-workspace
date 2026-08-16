import { useState, type FormEvent } from "react";
import { Eye, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { EmptyRow, StatusPill } from "@/shared/components/ui-kit";
import type { TransactionReferenceData } from "./reference-data";
import { createFinanceRecord, deleteFinanceRecord, updateFinanceRecord } from "./api";
import { errorMessage, formatDate } from "./documents-page";
import type { CashAccount, ExchangeRate, FinancialDirectory, ManagerialAccount } from "./types";

type Entity = "account" | "cash" | "rate";
type RecordValue = ManagerialAccount | CashAccount | ExchangeRate;
type ModalState =
  | { entity: Entity; action: "create" }
  | { entity: Entity; action: "view" | "edit" | "destroy"; record: RecordValue }
  | null;

export function FinanceSettingsDialog({
  open,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  open: boolean;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  if (!open) return null;

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-[92vw] overflow-y-auto xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Cadastros financeiros</DialogTitle>
          <DialogDescription>
            Plano de contas gerencial, contas de caixa e taxas de câmbio. Nenhuma senha ou
            credencial bancária é armazenada.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="accounts">
              Plano gerencial ({directory.accounts.length})
            </TabsTrigger>
            <TabsTrigger value="cash">
              Contas de caixa ({directory.cashAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="rates">Câmbio ({directory.exchangeRates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <SettingsSection
              title="Contas gerenciais"
              description="Contas do sistema permanecem protegidas; novas contas podem complementar o plano."
              onCreate={() => setModal({ entity: "account", action: "create" })}
            >
              <AccountsTable records={directory.accounts} onAction={setModal} />
            </SettingsSection>
          </TabsContent>

          <TabsContent value="cash">
            <SettingsSection
              title="Contas financeiras"
              description="Bancos, carteiras, processadores, contas de compensação e caixa."
              onCreate={() => setModal({ entity: "cash", action: "create" })}
            >
              <CashTable
                records={directory.cashAccounts}
                directory={directory}
                onAction={setModal}
              />
            </SettingsSection>
          </TabsContent>

          <TabsContent value="rates">
            <SettingsSection
              title="Taxas de câmbio"
              description="A taxa aplicada ao documento continua registrada no próprio documento para preservar histórico."
              onCreate={() => setModal({ entity: "rate", action: "create" })}
            >
              <RatesTable records={directory.exchangeRates} onAction={setModal} />
            </SettingsSection>
          </TabsContent>
        </Tabs>

        <SettingsRecordDialog
          state={modal}
          directory={directory}
          structure={structure}
          onClose={() => setModal(null)}
          onChanged={async () => {
            await onChanged();
            setModal(null);
          }}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  description,
  onCreate,
  children,
}: {
  title: string;
  description: string;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-sm border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus /> Criar
        </Button>
      </div>
      {children}
    </div>
  );
}

function AccountsTable({
  records,
  onAction,
}: {
  records: ManagerialAccount[];
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Código</th>
            <th className="px-4 py-2 text-left">Nome</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2 text-left">Natureza</th>
            <th className="px-4 py-2 text-left">Postagem</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && <EmptyRow colSpan={7} label="Nenhuma conta gerencial." />}
          {records.map((record) => (
            <tr key={record.id} className="border-t">
              <td className="num px-4 py-3">{record.code}</td>
              <td className="px-4 py-3">
                {record.name}
                {record.is_system && (
                  <p className="mt-1 text-xs text-muted-foreground">Conta protegida do sistema</p>
                )}
              </td>
              <td className="px-4 py-3">{accountTypeLabel(record.account_type)}</td>
              <td className="px-4 py-3">
                {record.normal_balance === "debit" ? "Devedora" : "Credora"}
              </td>
              <td className="px-4 py-3">{record.posting_allowed ? "Permitida" : "Agrupadora"}</td>
              <td className="px-4 py-3">
                <StatusPill status={record.status} />
              </td>
              <td className="px-4 py-3">
                <ActionButtons
                  entity="account"
                  record={record}
                  canEdit={!record.is_system}
                  onAction={onAction}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashTable({
  records,
  directory,
  onAction,
}: {
  records: CashAccount[];
  directory: FinancialDirectory;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Conta</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2 text-left">Moeda</th>
            <th className="px-4 py-2 text-left">Instituição</th>
            <th className="px-4 py-2 text-left">Conta gerencial</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <EmptyRow colSpan={7} label="Nenhuma conta financeira cadastrada." />
          )}
          {records.map((record) => (
            <tr key={record.id} className="border-t">
              <td className="px-4 py-3">
                <p className="font-medium">{record.name}</p>
                <p className="num mt-1 text-xs text-muted-foreground">
                  {record.code} · {record.masked_identifier ?? "sem identificador"}
                </p>
              </td>
              <td className="px-4 py-3">{cashTypeLabel(record.account_type)}</td>
              <td className="num px-4 py-3">{record.currency_code}</td>
              <td className="px-4 py-3">{record.institution_name ?? "—"}</td>
              <td className="px-4 py-3">{accountName(directory, record.managerial_account_id)}</td>
              <td className="px-4 py-3">
                <StatusPill status={record.status} />
              </td>
              <td className="px-4 py-3">
                <ActionButtons entity="cash" record={record} canEdit onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatesTable({
  records,
  onAction,
}: {
  records: ExchangeRate[];
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Par</th>
            <th className="px-4 py-2 text-left">Data</th>
            <th className="px-4 py-2 text-right">Taxa</th>
            <th className="px-4 py-2 text-left">Fonte</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <EmptyRow colSpan={6} label="Nenhuma taxa de câmbio cadastrada." />
          )}
          {records.map((record) => (
            <tr key={record.id} className="border-t">
              <td className="num px-4 py-3">
                {record.base_currency_code}/{record.quote_currency_code}
              </td>
              <td className="num px-4 py-3">{formatDate(record.rate_date)}</td>
              <td className="num px-4 py-3 text-right">{Number(record.rate).toFixed(10)}</td>
              <td className="px-4 py-3">{record.source}</td>
              <td className="px-4 py-3">
                <StatusPill status={record.status} />
              </td>
              <td className="px-4 py-3">
                <ActionButtons entity="rate" record={record} canEdit onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionButtons({
  entity,
  record,
  canEdit,
  onAction,
}: {
  entity: Entity;
  record: RecordValue;
  canEdit: boolean;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onAction({ entity, action: "view", record })}
      >
        <Eye /> Ver
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!canEdit}
        onClick={() => onAction({ entity, action: "edit", record })}
      >
        <Pencil /> Editar
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={!canEdit}
        onClick={() => onAction({ entity, action: "destroy", record })}
      >
        <Trash2 /> Excluir
      </Button>
    </div>
  );
}

function SettingsRecordDialog({
  state,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  state: ModalState;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!state) return null;
  if (state.action === "view") {
    return (
      <ViewSettingsDialog
        state={state as { entity: Entity; action: "view"; record: RecordValue }}
        directory={directory}
        onClose={onClose}
      />
    );
  }
  if (state.action === "destroy") {
    return (
      <DestroySettingsDialog
        key={`${state.entity}-${state.record.id}`}
        state={state as { entity: Entity; action: "destroy"; record: RecordValue }}
        directory={directory}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <SettingsForm
      key={
        state.action === "create"
          ? `${state.entity}-new`
          : `${state.entity}-${state.record.id}-${state.record.version}`
      }
      entity={state.entity}
      record={state.action === "edit" ? state.record : null}
      directory={directory}
      structure={structure}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function SettingsForm({
  entity,
  record,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  entity: Entity;
  record: RecordValue | null;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const account = entity === "account" ? (record as ManagerialAccount | null) : null;
  const cash = entity === "cash" ? (record as CashAccount | null) : null;
  const rate = entity === "rate" ? (record as ExchangeRate | null) : null;
  const legalEntity = structure.legalEntities[0];

  const [code, setCode] = useState(account?.code ?? cash?.code ?? "");
  const [name, setName] = useState(account?.name ?? cash?.name ?? "");
  const [parentId, setParentId] = useState(account?.parent_id ?? "");
  const [accountType, setAccountType] = useState(account?.account_type ?? "expense");
  const [normalBalance, setNormalBalance] = useState(account?.normal_balance ?? "debit");
  const [postingAllowed, setPostingAllowed] = useState(account?.posting_allowed ?? true);
  const [status, setStatus] = useState(account?.status ?? cash?.status ?? rate?.status ?? "active");

  const [managerialAccountId, setManagerialAccountId] = useState(
    cash?.managerial_account_id ??
      directory.accounts.find((item) => item.code === "1100")?.id ??
      "",
  );
  const [cashType, setCashType] = useState(cash?.account_type ?? "bank");
  const [currency, setCurrency] = useState(cash?.currency_code ?? "BRL");
  const [institution, setInstitution] = useState(cash?.institution_name ?? "");
  const [maskedIdentifier, setMaskedIdentifier] = useState(cash?.masked_identifier ?? "");
  const [vaultReference, setVaultReference] = useState(cash?.external_vault_reference ?? "");

  const [baseCurrency, setBaseCurrency] = useState(rate?.base_currency_code ?? "USD");
  const [quoteCurrency, setQuoteCurrency] = useState(rate?.quote_currency_code ?? "BRL");
  const [rateDate, setRateDate] = useState(
    rate?.rate_date ?? new Date().toISOString().slice(0, 10),
  );
  const [rateValue, setRateValue] = useState(rate?.rate?.toString() ?? "");
  const [source, setSource] = useState(rate?.source ?? "Manual");
  const [sourceReference, setSourceReference] = useState(rate?.source_reference ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (entity === "account") {
        const values = {
          parent_id: parentId || null,
          code: code.trim(),
          name: name.trim(),
          account_type: accountType,
          normal_balance: normalBalance,
          posting_allowed: postingAllowed,
          status,
          is_system: account?.is_system ?? false,
        };
        if (account)
          await updateFinanceRecord<ManagerialAccount>(
            "managerial_accounts",
            account.id,
            account.version,
            values,
          );
        else await createFinanceRecord<ManagerialAccount>("managerial_accounts", values);
      } else if (entity === "cash") {
        if (!legalEntity) throw new Error("Pessoa jurídica não encontrada.");
        const values = {
          legal_entity_id: cash?.legal_entity_id ?? legalEntity.id,
          managerial_account_id: managerialAccountId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          account_type: cashType,
          currency_code: currency,
          institution_name: institution.trim() || null,
          masked_identifier: maskedIdentifier.trim() || null,
          external_vault_reference: vaultReference.trim() || null,
          status,
        };
        if (cash)
          await updateFinanceRecord<CashAccount>("cash_accounts", cash.id, cash.version, values);
        else await createFinanceRecord<CashAccount>("cash_accounts", values);
      } else {
        if (baseCurrency === quoteCurrency)
          throw new Error("Moeda base e moeda cotada devem ser diferentes.");
        const values = {
          base_currency_code: baseCurrency,
          quote_currency_code: quoteCurrency,
          rate_date: rateDate,
          rate: Number(rateValue),
          source: source.trim(),
          source_reference: sourceReference.trim() || null,
          status,
        };
        if (rate)
          await updateFinanceRecord<ExchangeRate>("exchange_rates", rate.id, rate.version, values);
        else await createFinanceRecord<ExchangeRate>("exchange_rates", values);
      }
      await onChanged();
      toast.success(record ? "Cadastro atualizado." : "Cadastro criado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {record ? "Editar" : "Criar"} {entityLabel(entity)}
            </DialogTitle>
            <DialogDescription>{entityDescription(entity)}</DialogDescription>
          </DialogHeader>

          {entity === "account" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Código numérico" value={code} onChange={setCode} required />
                <TextField label="Nome" value={name} onChange={setName} required />
              </div>
              <SelectField
                label="Conta superior"
                value={parentId}
                onChange={setParentId}
                options={[
                  ["", "Sem conta superior"],
                  ...directory.accounts
                    .filter((item) => item.id !== account?.id)
                    .map((item) => [item.id, `${item.code} — ${item.name}`] as const),
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Tipo"
                  value={accountType}
                  onChange={setAccountType}
                  options={accountTypeOptions}
                />
                <SelectField
                  label="Natureza"
                  value={normalBalance}
                  onChange={(value) => setNormalBalance(value as "debit" | "credit")}
                  options={normalBalanceOptions}
                />
                <SelectField
                  label="Situação"
                  value={status}
                  onChange={(value) =>
                    setStatus(value as "active" | "inactive" | "closed" | "superseded")
                  }
                  options={activeInactiveOptions}
                />
              </div>
              <CheckboxField
                label="Permitir postagem direta"
                checked={postingAllowed}
                onChange={setPostingAllowed}
              />
            </>
          )}

          {entity === "cash" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Código"
                  value={code}
                  onChange={(value) => setCode(value.toUpperCase())}
                  required
                />
                <TextField label="Nome" value={name} onChange={setName} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Tipo"
                  value={cashType}
                  onChange={setCashType}
                  options={cashTypeOptions}
                />
                <SelectField
                  label="Moeda"
                  value={currency}
                  onChange={setCurrency}
                  options={structure.currencies.map((item) => [
                    item.code,
                    `${item.code} — ${item.name}`,
                  ])}
                />
                <SelectField
                  label="Situação"
                  value={status}
                  onChange={(value) =>
                    setStatus(value as "active" | "inactive" | "closed" | "superseded")
                  }
                  options={cashStatusOptions}
                />
              </div>
              <SelectField
                label="Conta gerencial de caixa"
                value={managerialAccountId}
                onChange={setManagerialAccountId}
                options={directory.accounts
                  .filter(
                    (item) =>
                      item.posting_allowed &&
                      item.status === "active" &&
                      item.account_type === "asset",
                  )
                  .map((item) => [item.id, `${item.code} — ${item.name}`])}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Instituição" value={institution} onChange={setInstitution} />
                <TextField
                  label="Identificador mascarado"
                  value={maskedIdentifier}
                  onChange={setMaskedIdentifier}
                />
              </div>
              <TextField
                label="Referência externa de cofre"
                value={vaultReference}
                onChange={setVaultReference}
              />
              <p className="text-xs text-muted-foreground">
                Armazene somente o caminho ou identificador do segredo no cofre externo. Nunca
                informe senha, token ou credencial bancária.
              </p>
            </>
          )}

          {entity === "rate" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Moeda base"
                  value={baseCurrency}
                  onChange={setBaseCurrency}
                  options={structure.currencies.map((item) => [item.code, item.code])}
                />
                <SelectField
                  label="Moeda cotada"
                  value={quoteCurrency}
                  onChange={setQuoteCurrency}
                  options={structure.currencies.map((item) => [item.code, item.code])}
                />
                <TextField
                  label="Data"
                  type="date"
                  value={rateDate}
                  onChange={setRateDate}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Taxa"
                  type="number"
                  min="0.0000000001"
                  step="0.0000000001"
                  value={rateValue}
                  onChange={setRateValue}
                  required
                />
                <SelectField
                  label="Situação"
                  value={status}
                  onChange={(value) =>
                    setStatus(value as "active" | "inactive" | "closed" | "superseded")
                  }
                  options={rateStatusOptions}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Fonte" value={source} onChange={setSource} required />
                <TextField
                  label="Referência da fonte"
                  value={sourceReference}
                  onChange={setSourceReference}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewSettingsDialog({
  state,
  directory,
  onClose,
}: {
  state: { entity: Entity; action: "view"; record: RecordValue };
  directory: FinancialDirectory;
  onClose: () => void;
}) {
  const fields = viewFields(state.entity, state.record, directory);
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ver {entityLabel(state.entity)}</DialogTitle>
          <DialogDescription>Cadastro financeiro persistido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <InfoCard key={label} label={label} value={value} />
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestroySettingsDialog({
  state,
  directory,
  onClose,
  onChanged,
}: {
  state: { entity: Entity; action: "destroy"; record: RecordValue };
  directory: FinancialDirectory;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dependencies = dependencyCount(state.entity, state.record, directory);
  const protectedRecord =
    state.entity === "account" && (state.record as ManagerialAccount).is_system;
  const expected = recordCode(state.entity, state.record);
  const willInactivate = protectedRecord || dependencies > 0;

  async function destroy() {
    setSubmitting(true);
    try {
      if (protectedRecord)
        throw new Error("Conta do sistema não pode ser excluída ou inativada por esta interface.");
      if (willInactivate) {
        const table =
          state.entity === "account"
            ? "managerial_accounts"
            : state.entity === "cash"
              ? "cash_accounts"
              : "exchange_rates";
        await updateFinanceRecord(table, state.record.id, state.record.version, {
          status: "inactive",
        });
        toast.success("Cadastro inativado; vínculos históricos foram preservados.");
      } else {
        const table =
          state.entity === "account"
            ? "managerial_accounts"
            : state.entity === "cash"
              ? "cash_accounts"
              : "exchange_rates";
        await deleteFinanceRecord(table, state.record.id);
        toast.success("Cadastro excluído definitivamente.");
      }
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {entityLabel(state.entity)}</DialogTitle>
          <DialogDescription>
            {willInactivate
              ? "O cadastro possui vínculos e será inativado para preservar o histórico."
              : "O cadastro não possui vínculos e poderá ser excluído fisicamente."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{expected}</p>
          <p className="mt-1 text-xs text-muted-foreground">Dependências: {dependencies}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-delete">Digite {expected} para confirmar</Label>
          <Input
            id="settings-delete"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={protectedRecord || submitting || confirmation !== expected}
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />}
            {willInactivate ? "Inativar" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/20 p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={min}
        step={step}
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
        required
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-sm border p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const accountTypeOptions = options({
  asset: "Ativo",
  liability: "Passivo",
  equity: "Patrimônio/resultado",
  revenue: "Receita",
  deduction: "Dedução",
  expense: "Despesa",
  investment: "Investimento",
  reserve: "Reserva",
});
const normalBalanceOptions = options({ debit: "Devedora", credit: "Credora" });
const activeInactiveOptions = options({ active: "Ativo", inactive: "Inativo" });
const cashTypeOptions = options({
  bank: "Banco",
  wallet: "Carteira",
  payment_processor: "Processador",
  clearing: "Compensação",
  cash: "Caixa",
});
const cashStatusOptions = options({ active: "Ativa", inactive: "Inativa", closed: "Encerrada" });
const rateStatusOptions = options({
  active: "Ativa",
  superseded: "Substituída",
  inactive: "Inativa",
});
function options(values: Record<string, string>): Array<readonly [string, string]> {
  return Object.entries(values);
}

function entityLabel(entity: Entity): string {
  return { account: "conta gerencial", cash: "conta financeira", rate: "taxa de câmbio" }[entity];
}
function entityDescription(entity: Entity): string {
  return {
    account: "Amplie o plano gerencial sem alterar as contas protegidas do sistema.",
    cash: "Cadastre apenas metadados e referência externa de cofre.",
    rate: "Registre data, fonte e referência da cotação.",
  }[entity];
}
function accountTypeLabel(value: string): string {
  return accountTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}
function cashTypeLabel(value: string): string {
  return cashTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}
function accountName(directory: FinancialDirectory, id: string): string {
  const account = directory.accounts.find((item) => item.id === id);
  return account ? `${account.code} — ${account.name}` : "Conta indisponível";
}
function recordCode(entity: Entity, record: RecordValue): string {
  if (entity === "account") return (record as ManagerialAccount).code;
  if (entity === "cash") return (record as CashAccount).code;
  const rate = record as ExchangeRate;
  return `${rate.base_currency_code}/${rate.quote_currency_code}-${rate.rate_date}`;
}
function dependencyCount(
  entity: Entity,
  record: RecordValue,
  directory: FinancialDirectory,
): number {
  if (entity === "account") {
    const id = record.id;
    return (
      directory.cashAccounts.filter((item) => item.managerial_account_id === id).length +
      directory.documents.filter((item) => item.counterparty_account_id === id).length +
      directory.documentLines.filter((item) => item.managerial_account_id === id).length +
      directory.journalLines.filter((item) => item.managerial_account_id === id).length +
      directory.settlements.filter((item) => item.fee_account_id === id).length
    );
  }
  if (entity === "cash")
    return directory.settlements.filter((item) => item.cash_account_id === record.id).length;
  return 0;
}
function viewFields(
  entity: Entity,
  record: RecordValue,
  directory: FinancialDirectory,
): Array<[string, string]> {
  if (entity === "account") {
    const item = record as ManagerialAccount;
    return [
      ["Código", item.code],
      ["Nome", item.name],
      ["Tipo", accountTypeLabel(item.account_type)],
      ["Natureza", item.normal_balance],
      ["Postagem", item.posting_allowed ? "Permitida" : "Agrupadora"],
      ["Sistema", item.is_system ? "Sim" : "Não"],
      ["Situação", item.status],
      ["Versão", String(item.version)],
    ];
  }
  if (entity === "cash") {
    const item = record as CashAccount;
    return [
      ["Código", item.code],
      ["Nome", item.name],
      ["Tipo", cashTypeLabel(item.account_type)],
      ["Moeda", item.currency_code],
      ["Instituição", item.institution_name ?? "—"],
      ["Identificador", item.masked_identifier ?? "—"],
      ["Conta gerencial", accountName(directory, item.managerial_account_id)],
      ["Cofre externo", item.external_vault_reference ?? "—"],
    ];
  }
  const item = record as ExchangeRate;
  return [
    ["Par", `${item.base_currency_code}/${item.quote_currency_code}`],
    ["Data", formatDate(item.rate_date)],
    ["Taxa", Number(item.rate).toFixed(10)],
    ["Fonte", item.source],
    ["Referência", item.source_reference ?? "—"],
    ["Situação", item.status],
    ["Versão", String(item.version)],
  ];
}
