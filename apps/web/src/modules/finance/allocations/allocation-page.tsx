import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { hasPermission } from "@/modules/access-control/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import {
  createAllocationRecord,
  decideAllocationVersion,
  deleteAllocationRecord,
  listAllocationWorkspace,
  reverseAllocationRun,
  runAllocationAction,
  submitAllocationVersion,
} from "./api";
import type {
  AllocationDriverValue,
  AllocationMethod,
  AllocationRule,
  AllocationRuleVersion,
  AllocationRun,
  AllocationRunSource,
  AllocationTarget,
} from "./types";
import { SimpleAllocationPanel } from "./simple-allocation-panel";

const NONE_VALUE = "__none__";
const ALLOCATION_METHODS: AllocationMethod[] = [
  "fixed_percentage",
  "equal",
  "revenue",
  "direct_cost",
  "transaction_count",
  "headcount",
  "usage",
  "manual_driver",
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
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
      <Skeleton className="h-96 rounded-sm" />
    </div>
  );
}

type AllocationWorkspaceData = Awaited<ReturnType<typeof listAllocationWorkspace>>;

interface ReasonAction {
  kind: "reject-version" | "reject-run" | "reverse-run";
  id: string;
  version: number;
}

export function AllocationPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const readPermission = useQuery({
    queryKey: ["permission", "allocation.read"],
    queryFn: () => hasPermission("allocation.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "allocation.manage"],
    queryFn: () => hasPermission("allocation.manage"),
    enabled: Boolean(session && user),
  });
  const approvePermission = useQuery({
    queryKey: ["permission", "allocation.approve"],
    queryFn: () => hasPermission("allocation.approve"),
    enabled: Boolean(session && user),
  });
  const postPermission = useQuery({
    queryKey: ["permission", "allocation.post"],
    queryFn: () => hasPermission("allocation.post"),
    enabled: Boolean(session && user),
  });
  const reversePermission = useQuery({
    queryKey: ["permission", "allocation.reverse"],
    queryFn: () => hasPermission("allocation.reverse"),
    enabled: Boolean(session && user),
  });
  const canRead = Boolean(session && user && readPermission.data === true);
  const canManage = Boolean(session && user && managePermission.data === true);
  const canApprove = Boolean(session && user && approvePermission.data === true);
  const canPost = Boolean(session && user && postPermission.data === true);
  const canReverse = Boolean(session && user && reversePermission.data === true);
  const workspace = useQuery({
    queryKey: ["allocation-workspace"],
    queryFn: listAllocationWorkspace,
  });

  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));

  const data = workspace.data;
  const activeRuleId = data?.rules.some((item) => item.id === selectedRuleId)
    ? selectedRuleId
    : (data?.rules[0]?.id ?? "");
  const ruleVersions = useMemo(
    () => data?.versions.filter((item) => item.allocation_rule_id === activeRuleId) ?? [],
    [activeRuleId, data?.versions],
  );
  const activeVersionId = ruleVersions.some((item) => item.id === selectedVersionId)
    ? selectedVersionId
    : (ruleVersions[0]?.id ?? "");
  const activeRule = data?.rules.find((item) => item.id === activeRuleId) ?? null;
  const activeVersion = data?.versions.find((item) => item.id === activeVersionId) ?? null;
  const versionTargets = useMemo(
    () => data?.targets.filter((item) => item.allocation_rule_version_id === activeVersionId) ?? [],
    [activeVersionId, data?.targets],
  );
  const versionDrivers = useMemo(
    () =>
      data?.driverValues.filter((item) => item.allocation_rule_version_id === activeVersionId) ??
      [],
    [activeVersionId, data?.driverValues],
  );
  const activeRunId = data?.runs.some((item) => item.id === selectedRunId)
    ? selectedRunId
    : (data?.runs[0]?.id ?? "");
  const activeRun = data?.runs.find((item) => item.id === activeRunId) ?? null;
  const runSources = useMemo(
    () => data?.sources.filter((item) => item.allocation_run_id === activeRunId) ?? [],
    [activeRunId, data?.sources],
  );
  const runDistributions = useMemo(
    () => data?.distributions.filter((item) => item.allocation_run_id === activeRunId) ?? [],
    [activeRunId, data?.distributions],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["allocation-workspace"] });
  };

  const lifecycle = useMutation({
    mutationFn: async (input: {
      kind:
        | "submit-version"
        | "approve-version"
        | "simulate-run"
        | "submit-run"
        | "approve-run"
        | "post-run";
      id: string;
      version: number;
    }) => {
      if (input.kind === "submit-version") return submitAllocationVersion(input.id, input.version);
      if (input.kind === "approve-version") {
        return decideAllocationVersion({
          versionId: input.id,
          expectedVersion: input.version,
          approve: true,
        });
      }
      const actionMap = {
        "simulate-run": "simulate-run",
        "submit-run": "submit-run",
        "approve-run": "approve-run",
        "post-run": "post-run",
      } as const;
      return runAllocationAction({
        runId: input.id,
        expectedVersion: input.version,
        action: actionMap[input.kind],
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Operação de rateio concluída.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reasonMutation = useMutation({
    mutationFn: async () => {
      if (!reasonAction) throw new Error("Ação indisponível.");
      const normalized = reason.trim();
      if (normalized.length < 5) throw new Error("Informe um motivo com pelo menos 5 caracteres.");
      if (reasonAction.kind === "reject-version") {
        return decideAllocationVersion({
          versionId: reasonAction.id,
          expectedVersion: reasonAction.version,
          approve: false,
          reason: normalized,
        });
      }
      if (reasonAction.kind === "reject-run") {
        return runAllocationAction({
          runId: reasonAction.id,
          expectedVersion: reasonAction.version,
          action: "reject-run",
          reason: normalized,
        });
      }
      return reverseAllocationRun({
        runId: reasonAction.id,
        expectedVersion: reasonAction.version,
        reversalDate,
        reason: normalized,
      });
    },
    onSuccess: async () => {
      setReasonAction(null);
      setReason("");
      await refresh();
      toast.success("Operação concluída.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (workspace.isLoading) return <LoadingState />;
  if (workspace.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar Rateio</AlertTitle>
        <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  const activeRules = data.rules.filter((item) => item.status === "active").length;
  const pendingVersions = data.versions.filter((item) => item.status === "pending_approval").length;
  const pendingRuns = data.runs.filter((item) => item.status === "pending_approval").length;
  const postedTotal = data.runs
    .filter((item) => item.status === "posted")
    .reduce((sum, item) => sum + Number(item.allocated_total), 0);

  return (
    <div className="space-y-4">
      {!canRead && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo consultivo</AlertTitle>
          <AlertDescription>
            {session
              ? "Os dados reais estão disponíveis para leitura. Criação, aprovação, postagem e estorno exigem MFA e as permissões de Rateio."
              : "A estrutura completa permanece visível, mas regras, execuções e memórias de rateio exigem uma sessão autorizada."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Regras ativas"
          value={session ? String(activeRules) : "Não disponível"}
          hint={session ? `${data.rules.length} cadastradas` : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Versões pendentes"
          value={session ? String(pendingVersions) : "Não disponível"}
          hint={session ? "Aguardando decisão" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Execuções pendentes"
          value={session ? String(pendingRuns) : "Não disponível"}
          hint={session ? "Aguardando aprovação" : "Sessão autorizada necessária"}
        />
        <Kpi
          label="Total postado"
          value={session ? formatMoney(postedTotal) : "Não disponível"}
          hint={session ? "Rateios efetivados" : "Sessão autorizada necessária"}
        />
      </div>

      <SimpleAllocationPanel
        data={data}
        canManage={canManage}
        dataAccessRestricted={!session}
        onCreated={refresh}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-card p-3">
        <div>
          <h2 className="font-semibold">Configuração e workflow avançado</h2>
          <p className="text-sm text-muted-foreground">
            Distribuição interna com regra versionada, memória de cálculo, aprovação, postagem e
            estorno.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" disabled={!canManage} onClick={() => setCreateRuleOpen(true)}>
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
          <TabsTrigger value="rules">Regras e direcionadores</TabsTrigger>
          <TabsTrigger value="runs">Execuções e memória</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
            <Panel title="Regras" description="Origem e estado do cadastro mestre.">
              <div className="divide-y">
                {data.rules.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    {session ? "Nenhuma regra cadastrada." : "Regras exigem uma sessão autorizada."}
                  </p>
                ) : (
                  data.rules.map((rule) => {
                    const unit = data.businessUnits.find(
                      (item) => item.id === rule.source_business_unit_id,
                    );
                    return (
                      <button
                        type="button"
                        key={rule.id}
                        className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 ${
                          rule.id === activeRuleId ? "bg-muted/60" : ""
                        }`}
                        onClick={() => {
                          setSelectedRuleId(rule.id);
                          setSelectedVersionId("");
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {rule.code} · {rule.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {unit?.name ?? "Unidade indisponível"}
                          </p>
                        </div>
                        <StatusPill status={rule.status} />
                      </button>
                    );
                  })
                )}
              </div>
            </Panel>

            <Panel
              title={activeRule ? `${activeRule.code} · ${activeRule.name}` : "Versões da regra"}
              description="Somente rascunhos podem ser editados; versões aprovadas são preservadas."
            >
              {!activeRule ? (
                <p className="p-6 text-sm text-muted-foreground">Selecione uma regra.</p>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap gap-2">
                    {ruleVersions.map((version) => (
                      <Button
                        key={version.id}
                        size="sm"
                        variant={version.id === activeVersionId ? "default" : "outline"}
                        onClick={() => setSelectedVersionId(version.id)}
                      >
                        v{version.version_no} · {version.status}
                      </Button>
                    ))}
                  </div>
                  {activeVersion ? (
                    <>
                      <div className="grid gap-3 rounded-sm border p-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Método</p>
                          <p className="mt-1 font-medium">{activeVersion.method}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vigência</p>
                          <p className="mt-1 font-medium">
                            {formatDate(activeVersion.effective_start)} até{" "}
                            {formatDate(activeVersion.effective_end)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Alvos ativos</p>
                          <p className="mt-1 font-medium">
                            {versionTargets.filter((item) => item.is_active).length}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeVersion.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              disabled={!canManage}
                              onClick={() => setTargetOpen(true)}
                            >
                              <Plus className="h-4 w-4" /> Adicionar alvo
                            </Button>
                            {(activeVersion.method === "manual_driver" ||
                              activeVersion.method === "headcount" ||
                              activeVersion.method === "usage") && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canManage || versionTargets.length === 0}
                                onClick={() => setDriverOpen(true)}
                              >
                                Informar direcionador
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManage || lifecycle.isPending}
                              onClick={() =>
                                lifecycle.mutate({
                                  kind: "submit-version",
                                  id: activeVersion.id,
                                  version: activeVersion.version,
                                })
                              }
                            >
                              Submeter versão
                            </Button>
                          </>
                        )}
                        {activeVersion.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              disabled={!canApprove || lifecycle.isPending}
                              onClick={() =>
                                lifecycle.mutate({
                                  kind: "approve-version",
                                  id: activeVersion.id,
                                  version: activeVersion.version,
                                })
                              }
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!canApprove}
                              onClick={() =>
                                setReasonAction({
                                  kind: "reject-version",
                                  id: activeVersion.id,
                                  version: activeVersion.version,
                                })
                              }
                            >
                              Rejeitar
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="overflow-x-auto rounded-sm border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Unidade destino</TableHead>
                              <TableHead>Dimensão</TableHead>
                              <TableHead>Percentual fixo</TableHead>
                              <TableHead>Direcionadores</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {versionTargets.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="h-28 text-center text-muted-foreground"
                                >
                                  Nenhum alvo configurado.
                                </TableCell>
                              </TableRow>
                            ) : (
                              versionTargets.map((target) => {
                                const unit = data.businessUnits.find(
                                  (item) => item.id === target.business_unit_id,
                                );
                                const dimension =
                                  data.products.find((item) => item.id === target.product_id)
                                    ?.name ||
                                  data.serviceLines.find(
                                    (item) => item.id === target.service_line_id,
                                  )?.name ||
                                  data.projects.find((item) => item.id === target.project_id)
                                    ?.name ||
                                  data.costCenters.find((item) => item.id === target.cost_center_id)
                                    ?.name ||
                                  "Somente unidade";
                                const drivers = versionDrivers.filter(
                                  (item) => item.allocation_target_id === target.id,
                                );
                                return (
                                  <TableRow key={target.id}>
                                    <TableCell>{target.sequence_no}</TableCell>
                                    <TableCell>{unit?.name ?? "—"}</TableCell>
                                    <TableCell>{dimension}</TableCell>
                                    <TableCell>
                                      {target.fixed_percentage === null
                                        ? "—"
                                        : `${Number(target.fixed_percentage).toFixed(4)}%`}
                                    </TableCell>
                                    <TableCell>{drivers.length}</TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      A regra ainda não possui versão.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!canManage || !data.versions.some((item) => item.status === "approved")}
              onClick={() => setRunOpen(true)}
            >
              <Plus className="h-4 w-4" /> Nova execução
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
            <Panel title="Execuções" description="Simulações e rateios postados.">
              <div className="divide-y">
                {data.runs.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    {session
                      ? "Nenhuma execução criada."
                      : "Execuções exigem uma sessão autorizada."}
                  </p>
                ) : (
                  data.runs.map((run) => (
                    <button
                      type="button"
                      key={run.id}
                      className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 ${
                        run.id === activeRunId ? "bg-muted/60" : ""
                      }`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <div>
                        <p className="font-medium">{run.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(run.competence_date)} · {formatMoney(run.source_total)}
                        </p>
                      </div>
                      <StatusPill status={run.status} />
                    </button>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              title="Memória de cálculo"
              description="Origens, distribuições e totalização auditável."
            >
              {!activeRun ? (
                <p className="p-6 text-sm text-muted-foreground">Selecione uma execução.</p>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Kpi
                      label="Origem"
                      value={formatMoney(activeRun.source_total)}
                      hint={`${runSources.length} partida(s)`}
                    />
                    <Kpi
                      label="Distribuído"
                      value={formatMoney(activeRun.allocated_total)}
                      hint={`${runDistributions.length} linha(s)`}
                    />
                    <Kpi
                      label="Residual"
                      value={formatMoney(activeRun.residual_amount)}
                      hint={
                        Number(activeRun.residual_amount) === 0
                          ? "Memória fechada"
                          : "Revisão necessária"
                      }
                      tone={Number(activeRun.residual_amount) === 0 ? "positive" : "warning"}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(activeRun.status === "draft" || activeRun.status === "simulated") && (
                      <Button size="sm" disabled={!canManage} onClick={() => setSourceOpen(true)}>
                        <Plus className="h-4 w-4" /> Adicionar origem
                      </Button>
                    )}
                    {(activeRun.status === "draft" || activeRun.status === "simulated") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || lifecycle.isPending || runSources.length === 0}
                        onClick={() =>
                          lifecycle.mutate({
                            kind: "simulate-run",
                            id: activeRun.id,
                            version: activeRun.version,
                          })
                        }
                      >
                        <Calculator className="h-4 w-4" /> Simular
                      </Button>
                    )}
                    {activeRun.status === "simulated" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || lifecycle.isPending}
                        onClick={() =>
                          lifecycle.mutate({
                            kind: "submit-run",
                            id: activeRun.id,
                            version: activeRun.version,
                          })
                        }
                      >
                        Submeter
                      </Button>
                    )}
                    {activeRun.status === "pending_approval" && (
                      <>
                        <Button
                          size="sm"
                          disabled={!canApprove || lifecycle.isPending}
                          onClick={() =>
                            lifecycle.mutate({
                              kind: "approve-run",
                              id: activeRun.id,
                              version: activeRun.version,
                            })
                          }
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canApprove}
                          onClick={() =>
                            setReasonAction({
                              kind: "reject-run",
                              id: activeRun.id,
                              version: activeRun.version,
                            })
                          }
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {activeRun.status === "approved" && (
                      <Button
                        size="sm"
                        disabled={!canPost || lifecycle.isPending}
                        onClick={() =>
                          lifecycle.mutate({
                            kind: "post-run",
                            id: activeRun.id,
                            version: activeRun.version,
                          })
                        }
                      >
                        <CircleDollarSign className="h-4 w-4" /> Postar no Ledger
                      </Button>
                    )}
                    {activeRun.status === "posted" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!canReverse}
                        onClick={() =>
                          setReasonAction({
                            kind: "reverse-run",
                            id: activeRun.id,
                            version: activeRun.version,
                          })
                        }
                      >
                        Estornar
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-sm border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unidade destino</TableHead>
                          <TableHead>Base</TableHead>
                          <TableHead>Percentual</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runDistributions.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="h-28 text-center text-muted-foreground"
                            >
                              Execute a simulação para gerar a memória.
                            </TableCell>
                          </TableRow>
                        ) : (
                          runDistributions.map((distribution) => (
                            <TableRow key={distribution.id}>
                              <TableCell>
                                {data.businessUnits.find(
                                  (item) => item.id === distribution.business_unit_id,
                                )?.name ?? "—"}
                              </TableCell>
                              <TableCell>
                                {Number(distribution.driver_value).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                {Number(distribution.allocation_percentage).toFixed(4)}%
                              </TableCell>
                              <TableCell>{formatMoney(distribution.allocated_amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      <CreateRuleDialog
        open={createRuleOpen}
        onOpenChange={setCreateRuleOpen}
        disabled={!canManage}
        data={data}
        onCreated={async (ruleId, versionId) => {
          setSelectedRuleId(ruleId);
          setSelectedVersionId(versionId);
          await refresh();
        }}
      />
      <CreateTargetDialog
        open={targetOpen}
        onOpenChange={setTargetOpen}
        version={activeVersion}
        data={data}
        onCreated={refresh}
      />
      <CreateDriverDialog
        open={driverOpen}
        onOpenChange={setDriverOpen}
        version={activeVersion}
        targets={versionTargets}
        data={data}
        onCreated={refresh}
      />
      <CreateRunDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        data={data}
        onCreated={async (runId) => {
          setSelectedRunId(runId);
          await refresh();
        }}
      />
      <CreateSourceDialog
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        run={activeRun}
        data={data}
        onCreated={refresh}
      />
      <Dialog
        open={Boolean(reasonAction)}
        onOpenChange={(open) => {
          if (!open) {
            setReasonAction(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonAction?.kind === "reverse-run" ? "Estornar rateio" : "Registrar rejeição"}
            </DialogTitle>
            <DialogDescription>
              A justificativa será persistida na trilha operacional.
            </DialogDescription>
          </DialogHeader>
          {reasonAction?.kind === "reverse-run" && (
            <div className="space-y-2">
              <Label htmlFor="allocation-reversal-date">Data do estorno</Label>
              <Input
                id="allocation-reversal-date"
                type="date"
                value={reversalDate}
                onChange={(event) => setReversalDate(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="allocation-reason">Motivo</Label>
            <Textarea
              id="allocation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonAction(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || reasonMutation.isPending}
              onClick={() => reasonMutation.mutate()}
            >
              {reasonMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateRuleDialog({
  open,
  onOpenChange,
  disabled,
  data,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  data: AllocationWorkspaceData;
  onCreated: (ruleId: string, versionId: string) => Promise<void>;
}) {
  const [sourceUnitId, setSourceUnitId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<AllocationMethod>("equal");
  const [effectiveStart, setEffectiveStart] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: async () => {
      const unit = data.businessUnits.find((item) => item.id === sourceUnitId);
      if (!unit?.legal_entity_id)
        throw new Error("Selecione uma unidade com entidade jurídica válida.");
      if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code.trim().toUpperCase())) {
        throw new Error("O código deve ter de 3 a 40 caracteres em caixa alta.");
      }
      const rule = await createAllocationRecord<AllocationRule>("allocation_rules", {
        legal_entity_id: unit.legal_entity_id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || null,
        source_business_unit_id: sourceUnitId,
      });
      try {
        const version = await createAllocationRecord<AllocationRuleVersion>(
          "allocation_rule_versions",
          {
            allocation_rule_id: rule.id,
            version_no: 1,
            method,
            effective_start: effectiveStart,
            residual_strategy: "largest_fraction",
          },
        );
        return { rule, version };
      } catch (error) {
        await deleteAllocationRecord("allocation_rules", rule.id).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async ({ rule, version }) => {
      onOpenChange(false);
      setCode("");
      setName("");
      setDescription("");
      await onCreated(rule.id, version.id);
      toast.success("Regra e versão inicial criadas.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova regra de rateio</DialogTitle>
          <DialogDescription>Cria o cadastro mestre e a versão 1 em rascunho.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Unidade de origem</Label>
            <Select value={sourceUnitId} onValueChange={setSourceUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data.businessUnits
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as AllocationMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOCATION_METHODS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início da vigência</Label>
            <Input
              type="date"
              value={effectiveStart}
              onChange={(event) => setEffectiveStart(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={disabled || !sourceUnitId || name.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Criar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTargetDialog({
  open,
  onOpenChange,
  version,
  data,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AllocationRuleVersion | null;
  data: AllocationWorkspaceData;
  onCreated: () => Promise<void>;
}) {
  const [unitId, setUnitId] = useState("");
  const [dimensionType, setDimensionType] = useState("none");
  const [dimensionId, setDimensionId] = useState("");
  const [percentage, setPercentage] = useState("");
  const targets = version
    ? data.targets.filter((item) => item.allocation_rule_version_id === version.id)
    : [];
  const options =
    dimensionType === "product"
      ? data.products.filter((item) => item.business_unit_id === unitId)
      : dimensionType === "service"
        ? data.serviceLines.filter((item) => item.business_unit_id === unitId)
        : dimensionType === "project"
          ? data.projects.filter((item) => item.business_unit_id === unitId)
          : dimensionType === "cost_center"
            ? data.costCenters.filter(
                (item) => !item.business_unit_id || item.business_unit_id === unitId,
              )
            : [];
  const mutation = useMutation({
    mutationFn: async () => {
      if (!version || version.status !== "draft")
        throw new Error("A versão não aceita novos alvos.");
      const values: Record<string, unknown> = {
        allocation_rule_version_id: version.id,
        business_unit_id: unitId,
        sequence_no: targets.length + 1,
        fixed_percentage: percentage ? Number(percentage) : null,
      };
      if (dimensionType === "product") values.product_id = dimensionId;
      if (dimensionType === "service") values.service_line_id = dimensionId;
      if (dimensionType === "project") values.project_id = dimensionId;
      if (dimensionType === "cost_center") values.cost_center_id = dimensionId;
      return createAllocationRecord<AllocationTarget>("allocation_rule_targets", values);
    },
    onSuccess: async () => {
      onOpenChange(false);
      setUnitId("");
      setDimensionType("none");
      setDimensionId("");
      setPercentage("");
      await onCreated();
      toast.success("Alvo adicionado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar alvo</DialogTitle>
          <DialogDescription>Dimensão que receberá a distribuição.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Unidade destino</Label>
            <Select
              value={unitId}
              onValueChange={(value) => {
                setUnitId(value);
                setDimensionId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data.businessUnits
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dimensão adicional</Label>
            <Select
              value={dimensionType}
              onValueChange={(value) => {
                setDimensionType(value);
                setDimensionId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Somente unidade</SelectItem>
                <SelectItem value="product">Produto</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
                <SelectItem value="project">Projeto</SelectItem>
                <SelectItem value="cost_center">Centro de custo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dimensionType !== "none" && (
            <div className="space-y-2">
              <Label>Registro</Label>
              <Select value={dimensionId} onValueChange={setDimensionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code ? `${item.code} · ` : ""}
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {version?.method === "fixed_percentage" && (
            <div className="space-y-2">
              <Label>Percentual</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!unitId || (dimensionType !== "none" && !dimensionId) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDriverDialog({
  open,
  onOpenChange,
  version,
  targets,
  data,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AllocationRuleVersion | null;
  targets: AllocationTarget[];
  data: AllocationWorkspaceData;
  onCreated: () => Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [value, setValue] = useState("");
  const [evidence, setEvidence] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!version) throw new Error("Versão indisponível.");
      return createAllocationRecord<AllocationDriverValue>("allocation_driver_values", {
        allocation_rule_version_id: version.id,
        financial_period_id: periodId,
        allocation_target_id: targetId,
        driver_value: Number(value),
        source_type: "manual",
        evidence: evidence.trim() || null,
        status: "confirmed",
      });
    },
    onSuccess: async () => {
      onOpenChange(false);
      setTargetId("");
      setPeriodId("");
      setValue("");
      setEvidence("");
      await onCreated();
      toast.success("Direcionador registrado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informar direcionador</DialogTitle>
          <DialogDescription>Valor confirmado para um alvo e período financeiro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Alvo</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {data.businessUnits.find((item) => item.id === target.business_unit_id)?.name ??
                      target.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data.financialPeriods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {formatDate(period.period_start)} — {formatDate(period.period_end)} ·{" "}
                    {period.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Evidência</Label>
            <Textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!targetId || !periodId || !value || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRunDialog({
  open,
  onOpenChange,
  data,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AllocationWorkspaceData;
  onCreated: (runId: string) => Promise<void>;
}) {
  const [versionId, setVersionId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [competenceDate, setCompetenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const version = data.versions.find((item) => item.id === versionId);
      if (!version || version.status !== "approved")
        throw new Error("Selecione uma versão aprovada.");
      return createAllocationRecord<AllocationRun>("allocation_runs", {
        allocation_rule_version_id: version.id,
        financial_period_id: periodId,
        competence_date: competenceDate,
        description: description.trim(),
        method_snapshot: version.method,
      });
    },
    onSuccess: async (run) => {
      onOpenChange(false);
      setVersionId("");
      setPeriodId("");
      setDescription("");
      await onCreated(run.id);
      toast.success("Execução criada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova execução</DialogTitle>
          <DialogDescription>
            Cria uma execução em rascunho vinculada a uma versão aprovada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Versão aprovada</Label>
            <Select value={versionId} onValueChange={setVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data.versions
                  .filter((item) => item.status === "approved")
                  .map((version) => {
                    const rule = data.rules.find((item) => item.id === version.allocation_rule_id);
                    return (
                      <SelectItem key={version.id} value={version.id}>
                        {rule?.code ?? "Regra"} · v{version.version_no} · {version.method}
                      </SelectItem>
                    );
                  })}
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
                {data.financialPeriods
                  .filter((item) => item.status === "open" || item.status === "reopened")
                  .map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {formatDate(period.period_start)} — {formatDate(period.period_end)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Competência</Label>
            <Input
              type="date"
              value={competenceDate}
              onChange={(event) => setCompetenceDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              !versionId || !periodId || description.trim().length < 3 || mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Criar execução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSourceDialog({
  open,
  onOpenChange,
  run,
  data,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: AllocationRun | null;
  data: AllocationWorkspaceData;
  onCreated: () => Promise<void>;
}) {
  const [candidateId, setCandidateId] = useState("");
  const [amount, setAmount] = useState("");
  const used = new Set(
    data.sources
      .filter((item) => item.allocation_run_id === run?.id)
      .map((item) => item.journal_line_id),
  );
  const candidates = data.sourceCandidates.filter((item) => !used.has(item.journal_line_id));
  const selected = candidates.find((item) => item.journal_line_id === candidateId);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!run) throw new Error("Execução indisponível.");
      if (!selected) throw new Error("Selecione uma origem.");
      const selectedAmount = Number(amount);
      if (!(selectedAmount > 0) || selectedAmount > Number(selected.available_amount))
        throw new Error("Valor selecionado inválido.");
      return createAllocationRecord<AllocationRunSource>("allocation_run_sources", {
        allocation_run_id: run.id,
        journal_line_id: selected.journal_line_id,
        available_amount_snapshot: selected.available_amount,
        selected_amount: selectedAmount,
      });
    },
    onSuccess: async () => {
      onOpenChange(false);
      setCandidateId("");
      setAmount("");
      await onCreated();
      toast.success("Origem adicionada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar origem</DialogTitle>
          <DialogDescription>
            Partida postada com saldo ainda disponível para rateio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Partida de origem</Label>
            <Select
              value={candidateId}
              onValueChange={(value) => {
                setCandidateId(value);
                const candidate = candidates.find((item) => item.journal_line_id === value);
                setAmount(candidate ? String(candidate.available_amount) : "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.journal_line_id} value={candidate.journal_line_id}>
                    #{candidate.entry_number} · {candidate.account_code} ·{" "}
                    {candidate.entry_description} · {formatMoney(candidate.available_amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor selecionado</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={selected?.available_amount}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {selected && (
            <div className="rounded-sm border p-3 text-sm">
              <p className="font-medium">{selected.account_name}</p>
              <p className="text-muted-foreground">
                Disponível: {formatMoney(selected.available_amount)} · competência{" "}
                {formatDate(selected.competence_date)}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || !amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Adicionar
            origem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
