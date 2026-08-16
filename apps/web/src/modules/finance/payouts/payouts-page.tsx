import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Eye,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
import {
  createPayoutPayment,
  listPayoutSettlements,
  listPayoutWorkspace,
  postPayoutPayment,
} from "./api";
import type { PayoutObligation, PayoutWorkspace, SettlementOption } from "./types";
import { summarizePayoutObligations } from "./payout-summary";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado no módulo de Repasses.";
}

function formatMoney(value: number | string | null | undefined, currency = "BRL") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-sm" />
        ))}
      </div>
      <Skeleton className="h-[520px] rounded-sm" />
    </div>
  );
}

export function PayoutsPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const [paymentObligation, setPaymentObligation] = useState<PayoutObligation | null>(null);
  const [detailObligation, setDetailObligation] = useState<PayoutObligation | null>(null);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const workspace = useQuery({ queryKey: ["payout-workspace"], queryFn: listPayoutWorkspace });
  const readPermission = useQuery({
    queryKey: ["permission", "payout.read"],
    queryFn: () => hasPermission("payout.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "payout.manage"],
    queryFn: () => hasPermission("payout.manage"),
    enabled: Boolean(session && user),
  });
  const postPermission = useQuery({
    queryKey: ["permission", "payout.post"],
    queryFn: () => hasPermission("payout.post"),
    enabled: Boolean(session && user),
  });

  const canRead = Boolean(session && user && readPermission.data === true);
  const canManage = Boolean(session && user && managePermission.data === true);
  const canPost = Boolean(session && user && postPermission.data === true);
  const data = workspace.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["payout-workspace"] });
  };

  const posting = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      postPayoutPayment(id, version),
    onSuccess: async () => {
      await refresh();
      toast.success("Pagamento conciliado e postado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (
    workspace.isLoading ||
    (session &&
      user &&
      (readPermission.isLoading || managePermission.isLoading || postPermission.isLoading))
  ) {
    return <LoadingState />;
  }

  if (workspace.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar Repasses</AlertTitle>
        <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
      </Alert>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const {
    due: totalDue,
    pending: payable,
    overdue,
    paid,
  } = summarizePayoutObligations(data.obligations, today);
  const drafts = data.payments.filter((item) => item.status === "draft").length;
  const term = search.trim().toLowerCase();
  const filteredObligations = data.obligations.filter((obligation) => {
    const party = data.parties.find((item) => item.id === obligation.beneficiary_party_id);
    const contract = data.contracts.find((item) => item.id === obligation.contract_id);
    const unit = data.businessUnits.find((item) => item.id === obligation.business_unit_id);
    return (
      (unitFilter === "all" || obligation.business_unit_id === unitFilter) &&
      (statusFilter === "all" || obligation.status === statusFilter) &&
      [party?.trade_name, party?.legal_name, contract?.code, contract?.title, unit?.name]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {!canRead && !canManage && !canPost && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo consultivo</AlertTitle>
          <AlertDescription>
            {session
              ? "Obrigações e pagamentos estão disponíveis para leitura. Registrar ou postar pagamentos exige MFA e permissões de Repasses."
              : "A estrutura completa permanece visível, mas obrigações e pagamentos exigem uma sessão autorizada."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total devido"
          value={session ? formatMoney(totalDue) : "Não disponível"}
          hint={session ? "Obrigações válidas" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Total pago"
          value={session ? formatMoney(paid) : "Não disponível"}
          hint={session ? "Pagamentos reconhecidos" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Saldo pendente"
          value={session ? formatMoney(payable) : "Não disponível"}
          hint={session ? `${drafts} pagamento(s) em rascunho` : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Saldo vencido"
          value={session ? formatMoney(overdue) : "Não disponível"}
          hint={session ? "Exige regularização" : "Sessão autorizada necessária"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-card p-3">
        <div>
          <h2 className="font-semibold">Repasses</h2>
          <p className="text-sm text-muted-foreground">
            Obrigações financeiras derivadas das participações, pagamentos e conciliação bancária.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Panel
        title="Quem deve receber"
        description="Acompanhe devido, pago e pendente por beneficiário, unidade e origem contratual."
      >
        <div className="grid gap-2 border-b p-4 md:grid-cols-[minmax(0,1fr)_220px_190px]">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar beneficiário, contrato ou unidade"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {data.businessUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="partially_paid">Parcialmente pago</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="held">Retido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Beneficiário</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Valor devido</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredObligations.length === 0 && (
                <EmptyRow
                  colSpan={9}
                  label={
                    session
                      ? "Nenhum repasse corresponde aos filtros. Obrigações surgem após a postagem de uma apuração contratual."
                      : "Obrigações de repasse exigem uma sessão autorizada."
                  }
                />
              )}
              {filteredObligations.map((obligation) => {
                const beneficiary = data.parties.find(
                  (item) => item.id === obligation.beneficiary_party_id,
                );
                const contract = data.contracts.find((item) => item.id === obligation.contract_id);
                const unit = data.businessUnits.find(
                  (item) => item.id === obligation.business_unit_id,
                );
                const balance = Number(obligation.amount) - Number(obligation.paid_amount);
                return (
                  <TableRow key={obligation.id}>
                    <TableCell className="font-medium">
                      {beneficiary?.trade_name ||
                        beneficiary?.legal_name ||
                        "Beneficiário indisponível"}
                    </TableCell>
                    <TableCell>{unit?.name || "Unidade indisponível"}</TableCell>
                    <TableCell>
                      <strong>{contract?.code || "—"}</strong>
                      <span className="block max-w-56 truncate text-xs text-muted-foreground">
                        {contract?.title || "Apuração contratual"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatMoney(obligation.amount, obligation.currency_code)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(obligation.paid_amount, obligation.currency_code)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(balance, obligation.currency_code)}
                    </TableCell>
                    <TableCell>{formatDate(obligation.due_date)}</TableCell>
                    <TableCell>
                      <StatusPill status={obligation.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Ver histórico do repasse"
                          onClick={() => setDetailObligation(obligation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(obligation.status === "open" ||
                          obligation.status === "partially_paid") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canManage || balance <= 0}
                            onClick={() => setPaymentObligation(obligation)}
                          >
                            <CircleDollarSign className="h-4 w-4" /> Registrar pagamento
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Panel
        title="Pagamentos e conciliação"
        description="Cada pagamento deve apontar para uma liquidação financeira já postada."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Beneficiário</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Liquidação</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  label={
                    session
                      ? "Nenhum pagamento registrado."
                      : "Pagamentos exigem uma sessão autorizada."
                  }
                />
              )}
              {data.payments.map((payment) => {
                const obligation = data.obligations.find(
                  (item) => item.id === payment.payout_obligation_id,
                );
                const beneficiary = data.parties.find(
                  (item) => item.id === obligation?.beneficiary_party_id,
                );
                return (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paid_on)}</TableCell>
                    <TableCell className="font-medium">
                      {beneficiary?.trade_name ||
                        beneficiary?.legal_name ||
                        "Beneficiário indisponível"}
                    </TableCell>
                    <TableCell>{formatMoney(payment.amount, payment.currency_code)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.financial_settlement_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <StatusPill status={payment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status === "draft" && (
                        <Button
                          size="sm"
                          disabled={!canPost || posting.isPending}
                          onClick={() =>
                            posting.mutate({ id: payment.id, version: payment.version })
                          }
                        >
                          <WalletCards className="h-4 w-4" /> Postar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {paymentObligation && user && (
        <PaymentDialog
          obligation={paymentObligation}
          userId={user.id}
          onClose={() => setPaymentObligation(null)}
          onChanged={refresh}
        />
      )}

      {detailObligation && (
        <PayoutTimelineDialog
          obligation={detailObligation}
          data={data}
          onClose={() => setDetailObligation(null)}
        />
      )}
    </div>
  );
}

function PayoutTimelineDialog({
  obligation,
  data,
  onClose,
}: {
  obligation: PayoutObligation;
  data: PayoutWorkspace;
  onClose: () => void;
}) {
  const beneficiary = data.parties.find((item) => item.id === obligation.beneficiary_party_id);
  const contract = data.contracts.find((item) => item.id === obligation.contract_id);
  const payments = data.payments
    .filter((item) => item.payout_obligation_id === obligation.id)
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  const pending = Number(obligation.amount) - Number(obligation.paid_amount);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico do repasse</DialogTitle>
          <DialogDescription>
            {beneficiary?.trade_name || beneficiary?.legal_name || "Beneficiário"} ·{" "}
            {contract?.code || "Origem contratual"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-3">
          <Summary
            label="Devido"
            value={formatMoney(obligation.amount, obligation.currency_code)}
          />
          <Summary
            label="Pago"
            value={formatMoney(obligation.paid_amount, obligation.currency_code)}
          />
          <Summary label="Pendente" value={formatMoney(pending, obligation.currency_code)} />
        </div>
        <ol className="space-y-3 border-l pl-5 text-sm">
          <li>
            <strong>Obrigação criada</strong>
            <span className="block text-muted-foreground">
              Originada pela apuração {obligation.participation_calculation_id.slice(0, 8)}…
            </span>
          </li>
          {payments.map((payment) => (
            <li key={payment.id}>
              <strong>Pagamento de {formatMoney(payment.amount, payment.currency_code)}</strong>
              <span className="block text-muted-foreground">
                {formatDate(payment.paid_on)} ·{" "}
                {payment.status === "posted" ? "reconhecido" : payment.status}
              </span>
            </li>
          ))}
          <li>
            <strong>Saldo atual</strong>
            <span className="block text-muted-foreground">
              {formatMoney(pending, obligation.currency_code)} · vencimento{" "}
              {formatDate(obligation.due_date)}
            </span>
          </li>
        </ol>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block">{value}</strong>
    </div>
  );
}

function PaymentDialog({
  obligation,
  userId,
  onClose,
  onChanged,
}: {
  obligation: PayoutObligation;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const settlements = useQuery({
    queryKey: ["payout-settlements", obligation.id],
    queryFn: () => listPayoutSettlements(obligation.id),
  });
  const [settlementId, setSettlementId] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(
    String(Number(obligation.amount) - Number(obligation.paid_amount)),
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedSettlement = settlements.data?.find((item) => item.id === settlementId) ?? null;
  const openBalance = Number(obligation.amount) - Number(obligation.paid_amount);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settlementId) {
      toast.error("Selecione a liquidação financeira que comprova o pagamento.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > openBalance) {
      toast.error("Informe um valor positivo dentro do saldo da obrigação.");
      return;
    }
    if (selectedSettlement && numericAmount !== Number(selectedSettlement.original_amount)) {
      toast.error("O valor deve coincidir com a liquidação financeira selecionada.");
      return;
    }

    setSubmitting(true);
    try {
      await createPayoutPayment({
        payout_obligation_id: obligation.id,
        financial_settlement_id: settlementId,
        paid_on: paidOn,
        amount: numericAmount,
        currency_code: obligation.currency_code,
        status: "draft",
        created_by: userId,
        updated_by: userId,
      });
      await onChanged();
      toast.success("Pagamento registrado em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento de repasse</DialogTitle>
          <DialogDescription>
            Saldo disponível: {formatMoney(openBalance, obligation.currency_code)}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Liquidação financeira</Label>
            {settlements.isLoading ? (
              <div className="flex items-center gap-2 rounded-sm border p-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando liquidações…
              </div>
            ) : settlements.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(settlements.error)}</AlertDescription>
              </Alert>
            ) : (
              <Select value={settlementId} onValueChange={setSettlementId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma liquidação postada" />
                </SelectTrigger>
                <SelectContent>
                  {(settlements.data ?? []).map((settlement: SettlementOption) => (
                    <SelectItem key={settlement.id} value={settlement.id}>
                      {formatDate(settlement.settlement_date)} · {settlement.cash_account_name} ·{" "}
                      {formatMoney(settlement.original_amount, settlement.original_currency_code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payout-paid-on">Data</Label>
              <Input
                id="payout-paid-on"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Valor</Label>
              <Input
                id="payout-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || settlements.isLoading || !settlementId}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
