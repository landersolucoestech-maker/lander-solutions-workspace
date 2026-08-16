import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
import {
  createParticipationCalculation,
  listParticipationWorkspace,
  runParticipationAction,
} from "./api";
import type { ParticipationCalculation, ParticipationStatus, ParticipationLine } from "./types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado no módulo de Participações.";
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

function statusHint(status: ParticipationStatus) {
  const hints: Record<ParticipationStatus, string> = {
    draft: "Rascunho editável",
    calculated: "Memória calculada",
    pending_approval: "Aguardando decisão",
    approved: "Pronta para postagem",
    posted: "Obrigações geradas",
    reversed: "Revertida",
    cancelled: "Cancelada",
  };
  return hints[status];
}

export function ParticipationsPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const [selectedCalculationId, setSelectedCalculationId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectCalculation, setRejectCalculation] = useState<ParticipationCalculation | null>(null);

  const workspace = useQuery({
    queryKey: ["participation-calculation-workspace"],
    queryFn: listParticipationWorkspace,
  });
  const readPermission = useQuery({
    queryKey: ["permission", "participation.read"],
    queryFn: () => hasPermission("participation.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "participation.manage"],
    queryFn: () => hasPermission("participation.manage"),
    enabled: Boolean(session && user),
  });
  const approvePermission = useQuery({
    queryKey: ["permission", "participation.approve"],
    queryFn: () => hasPermission("participation.approve"),
    enabled: Boolean(session && user),
  });
  const postPermission = useQuery({
    queryKey: ["permission", "participation.post"],
    queryFn: () => hasPermission("participation.post"),
    enabled: Boolean(session && user),
  });

  const data = workspace.data;
  const canRead = Boolean(session && user && readPermission.data === true);
  const canManage = Boolean(session && user && managePermission.data === true);
  const canApprove = Boolean(session && user && approvePermission.data === true);
  const canPost = Boolean(session && user && postPermission.data === true);

  const activeCalculationId = data?.calculations.some((item) => item.id === selectedCalculationId)
    ? selectedCalculationId
    : (data?.calculations[0]?.id ?? "");
  const activeCalculation =
    data?.calculations.find((item) => item.id === activeCalculationId) ?? null;
  const calculationLines = useMemo(
    () =>
      data?.lines.filter((item) => item.participation_calculation_id === activeCalculationId) ?? [],
    [activeCalculationId, data?.lines],
  );
  const calculationApprovals = useMemo(
    () =>
      data?.approvals.filter((item) => item.participation_calculation_id === activeCalculationId) ??
      [],
    [activeCalculationId, data?.approvals],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["participation-calculation-workspace"] });
  };

  const lifecycle = useMutation({
    mutationFn: (input: {
      calculation: ParticipationCalculation;
      action: "calculate" | "submit" | "approve" | "post";
    }) =>
      runParticipationAction({
        calculationId: input.calculation.id,
        expectedVersion: input.calculation.version,
        action: input.action,
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Workflow de participação concluído.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (
    workspace.isLoading ||
    (session &&
      user &&
      (readPermission.isLoading ||
        managePermission.isLoading ||
        approvePermission.isLoading ||
        postPermission.isLoading))
  ) {
    return <LoadingState />;
  }

  if (workspace.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar Participações Contratuais</AlertTitle>
        <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
      </Alert>
    );
  }

  const posted = data.calculations.filter((item) => item.status === "posted").length;
  const pending = data.calculations.filter((item) => item.status === "pending_approval").length;
  const distributable = data.calculations.reduce(
    (sum, item) => sum + Number(item.distributable_base),
    0,
  );
  const calculatedLines = data.lines.reduce((sum, item) => sum + Number(item.net_payable), 0);

  return (
    <div className="space-y-4">
      {!canRead && !canManage && !canApprove && !canPost && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo consultivo</AlertTitle>
          <AlertDescription>
            {session
              ? "Apurações e memórias estão disponíveis para leitura. Calcular, aprovar e postar exige MFA e permissões específicas de Participações."
              : "A estrutura completa permanece visível, mas apurações e memórias exigem uma sessão autorizada."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Apurações postadas"
          value={session ? String(posted) : "Não disponível"}
          hint={session ? `${data.calculations.length} no total` : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Pendentes de aprovação"
          value={session ? String(pending) : "Não disponível"}
          hint={session ? "Exigem decisão segregada" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Base distribuível"
          value={session ? formatMoney(distributable) : "Não disponível"}
          hint={session ? "Somatório das apurações" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Participações calculadas"
          value={session ? formatMoney(calculatedLines) : "Não disponível"}
          hint={session ? `${data.lines.length} linha(s)` : "Sessão autorizada necessária"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-card p-3">
        <div>
          <h2 className="font-semibold">Participações Contratuais</h2>
          <p className="text-sm text-muted-foreground">
            Apuração da base econômica, deduções, memória por beneficiário, aprovação e postagem.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova apuração
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]">
        <Panel title="Apurações" description="Períodos e contratos processados.">
          <div className="divide-y">
            {data.calculations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {session ? "Nenhuma apuração criada." : "Apurações exigem uma sessão autorizada."}
              </p>
            ) : (
              data.calculations.map((calculation) => {
                const contract = data.contracts.find((item) => item.id === calculation.contract_id);
                return (
                  <button
                    key={calculation.id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 ${
                      calculation.id === activeCalculationId ? "bg-muted/60" : ""
                    }`}
                    onClick={() => setSelectedCalculationId(calculation.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{calculation.code}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contract?.title ?? "Contrato indisponível"} ·{" "}
                        {formatDate(calculation.competence_start)} a{" "}
                        {formatDate(calculation.competence_end)}
                      </p>
                    </div>
                    <StatusPill status={calculation.status} />
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <Panel title="Memória de cálculo" description="Base, deduções e valores por beneficiário.">
          {!activeCalculation ? (
            <p className="p-6 text-sm text-muted-foreground">Selecione uma apuração.</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Receita bruta"
                  value={formatMoney(
                    activeCalculation.gross_revenue,
                    activeCalculation.currency_code,
                  )}
                  hint="Base econômica inicial"
                />
                <Kpi
                  label="Deduções"
                  value={formatMoney(activeCalculation.deductions, activeCalculation.currency_code)}
                  hint="Reduções contratuais"
                />
                <Kpi
                  label="Base distribuível"
                  value={formatMoney(
                    activeCalculation.distributable_base,
                    activeCalculation.currency_code,
                  )}
                  hint="Após deduções e custos"
                />
                <Kpi
                  label="Valor líquido"
                  value={formatMoney(
                    calculationLines.reduce((sum, item) => sum + Number(item.net_payable), 0),
                    activeCalculation.currency_code,
                  )}
                  hint={`${calculationLines.length} beneficiário(s)`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeCalculation.status === "draft" && (
                  <Button
                    size="sm"
                    disabled={!canManage || lifecycle.isPending}
                    onClick={() =>
                      lifecycle.mutate({ calculation: activeCalculation, action: "calculate" })
                    }
                  >
                    <Calculator className="h-4 w-4" /> Calcular
                  </Button>
                )}
                {activeCalculation.status === "calculated" && (
                  <Button
                    size="sm"
                    disabled={!canManage || lifecycle.isPending}
                    onClick={() =>
                      lifecycle.mutate({ calculation: activeCalculation, action: "submit" })
                    }
                  >
                    Submeter para aprovação
                  </Button>
                )}
                {activeCalculation.status === "pending_approval" && (
                  <>
                    <Button
                      size="sm"
                      disabled={!canApprove || lifecycle.isPending}
                      onClick={() =>
                        lifecycle.mutate({ calculation: activeCalculation, action: "approve" })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canApprove || lifecycle.isPending}
                      onClick={() => setRejectCalculation(activeCalculation)}
                    >
                      Rejeitar
                    </Button>
                  </>
                )}
                {activeCalculation.status === "approved" && (
                  <Button
                    size="sm"
                    disabled={!canPost || lifecycle.isPending}
                    onClick={() =>
                      lifecycle.mutate({ calculation: activeCalculation, action: "post" })
                    }
                  >
                    Postar apuração
                  </Button>
                )}
                <Badge variant="outline">v{activeCalculation.version}</Badge>
                <span className="text-xs text-muted-foreground">
                  {statusHint(activeCalculation.status)}
                </span>
              </div>

              <div className="overflow-x-auto rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Percentual</TableHead>
                      <TableHead>Valor bruto</TableHead>
                      <TableHead>Retenções</TableHead>
                      <TableHead>Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculationLines.length === 0 && (
                      <EmptyRow colSpan={6} label="Calcule a apuração para gerar a memória." />
                    )}
                    {calculationLines.map((line: ParticipationLine) => {
                      const beneficiary = data.parties.find((item) => item.id === line.party_id);
                      return (
                        <TableRow key={line.id}>
                          <TableCell>{line.sequence_no}</TableCell>
                          <TableCell className="font-medium">
                            {beneficiary?.trade_name ||
                              beneficiary?.legal_name ||
                              "Beneficiário indisponível"}
                          </TableCell>
                          <TableCell>{line.percentage}%</TableCell>
                          <TableCell>
                            {formatMoney(line.gross_share, activeCalculation.currency_code)}
                          </TableCell>
                          <TableCell>
                            {formatMoney(line.retention_amount, activeCalculation.currency_code)}
                          </TableCell>
                          <TableCell>
                            {formatMoney(line.net_payable, activeCalculation.currency_code)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-x-auto rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitada em</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Decidida em</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculationApprovals.length === 0 && (
                      <EmptyRow colSpan={4} label="Nenhuma solicitação de aprovação registrada." />
                    )}
                    {calculationApprovals.map((approval) => (
                      <TableRow key={approval.id}>
                        <TableCell>{formatDate(approval.requested_at)}</TableCell>
                        <TableCell>
                          <StatusPill status={approval.decision} />
                        </TableCell>
                        <TableCell>{formatDate(approval.decided_at)}</TableCell>
                        <TableCell>{approval.reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {createOpen && user && (
        <CreateCalculationDialog
          data={data}
          userId={user.id}
          onClose={() => setCreateOpen(false)}
          onChanged={refresh}
        />
      )}
      {rejectCalculation && (
        <RejectCalculationDialog
          calculation={rejectCalculation}
          onClose={() => setRejectCalculation(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function CreateCalculationDialog({
  data,
  userId,
  onClose,
  onChanged,
}: {
  data: Awaited<ReturnType<typeof listParticipationWorkspace>>;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [contractId, setContractId] = useState(data.contracts[0]?.id ?? "");
  const contract = data.contracts.find((item) => item.id === contractId) ?? null;
  const versions = data.contractVersions.filter(
    (item) =>
      item.contract_id === contractId &&
      ["approved", "effective", "superseded"].includes(item.status),
  );
  const [versionId, setVersionId] = useState(versions[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(data.periods[0]?.id ?? "");
  const period = data.periods.find((item) => item.id === periodId) ?? null;
  const [code, setCode] = useState("");
  const [grossRevenue, setGrossRevenue] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [directCosts, setDirectCosts] = useState("0");
  const [taxes, setTaxes] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectContract = (value: string) => {
    setContractId(value);
    const nextVersion = data.contractVersions.find(
      (item) =>
        item.contract_id === value && ["approved", "effective", "superseded"].includes(item.status),
    );
    setVersionId(nextVersion?.id ?? "");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contract || !versionId || !period) {
      toast.error("Contrato, versão e período financeiro são obrigatórios.");
      return;
    }
    const gross = Number(grossRevenue);
    const deductionsValue = Number(deductions);
    const costsValue = Number(directCosts);
    const taxesValue = Number(taxes);
    if (
      [gross, deductionsValue, costsValue, taxesValue].some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      toast.error("Informe valores numéricos não negativos.");
      return;
    }
    const distributable = gross - deductionsValue - costsValue - taxesValue;
    if (distributable < 0) {
      toast.error("A base distribuível não pode ser negativa.");
      return;
    }

    setSubmitting(true);
    try {
      await createParticipationCalculation({
        legal_entity_id: contract.legal_entity_id,
        business_unit_id: contract.business_unit_id,
        product_id: contract.product_id,
        service_line_id: contract.service_line_id,
        project_id: null,
        contract_id: contract.id,
        contract_version_id: versionId,
        financial_period_id: period.id,
        code: code.trim().toUpperCase(),
        competence_start: period.period_start,
        competence_end: period.period_end,
        currency_code: contract.currency_code,
        gross_revenue: gross,
        deductions: deductionsValue,
        direct_costs: costsValue,
        taxes: taxesValue,
        distributable_base: distributable,
        status: "draft",
        notes: notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
      await onChanged();
      toast.success("Apuração criada em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova apuração contratual</DialogTitle>
          <DialogDescription>
            A apuração usa contrato versionado e período financeiro como fontes canônicas.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={contractId} onValueChange={selectContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {data.contracts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} · {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Versão contratual</Label>
              <Select value={versionId} onValueChange={setVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      Versão {item.version_number} · {item.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período financeiro</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {data.periods.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {formatDate(item.period_start)} a {formatDate(item.period_end)} ·{" "}
                      {item.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="participation-code">Código</Label>
              <Input
                id="participation-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="participation-gross">Receita bruta</Label>
              <Input
                id="participation-gross"
                type="number"
                min="0"
                step="0.01"
                value={grossRevenue}
                onChange={(event) => setGrossRevenue(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participation-deductions">Deduções</Label>
              <Input
                id="participation-deductions"
                type="number"
                min="0"
                step="0.01"
                value={deductions}
                onChange={(event) => setDeductions(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participation-costs">Custos diretos</Label>
              <Input
                id="participation-costs"
                type="number"
                min="0"
                step="0.01"
                value={directCosts}
                onChange={(event) => setDirectCosts(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participation-taxes">Tributos</Label>
              <Input
                id="participation-taxes"
                type="number"
                min="0"
                step="0.01"
                value={taxes}
                onChange={(event) => setTaxes(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="participation-notes">Observações</Label>
            <Textarea
              id="participation-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando…" : "Criar apuração"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectCalculationDialog({
  calculation,
  onClose,
  onChanged,
}: {
  calculation: ParticipationCalculation;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos cinco caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await runParticipationAction({
        calculationId: calculation.id,
        expectedVersion: calculation.version,
        action: "reject",
        reason: reason.trim(),
      });
      await onChanged();
      toast.success("Apuração rejeitada.");
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
          <DialogTitle>Rejeitar apuração</DialogTitle>
          <DialogDescription>
            A decisão ficará registrada na trilha de aprovação de {calculation.code}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="participation-rejection">Motivo</Label>
            <Textarea
              id="participation-rejection"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              Rejeitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
