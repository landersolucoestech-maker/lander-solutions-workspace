import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  FileCheck2,
  Gavel,
  Landmark,
  Plus,
  RefreshCw,
  ShieldAlert,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
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
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
import {
  applyOwnershipChange,
  decideOwnershipChange,
  listCorporateOwnershipWorkspace,
  submitOwnershipChange,
} from "./api";
import {
  CorporateDocumentCreateDialog,
  OwnershipChangeCreateDialog,
  OwnershipChangeLineCreateDialog,
  ReasonDialog,
  ResolutionCreateDialog,
  ShareClassCreateDialog,
  StructureCreateDialog,
} from "./corporate-ownership-dialogs";
import { approveCorporateResolution } from "./api";
import type { CorporateResolution, OwnershipChange } from "./types";

type ModalKind = "structure" | "share-class" | "document" | "resolution" | "change" | "line";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro societário inesperado.";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function formatMoney(value: number | string, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value));
}

function formatQuantity(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(Number(value));
}

function partyName(
  parties: Array<{ id: string; legal_name: string; trade_name: string | null }>,
  id: string | null | undefined,
) {
  const party = parties.find((item) => item.id === id);
  return party?.trade_name || party?.legal_name || "Participante indisponível";
}

function profileName(
  profiles: Array<{ id: string; display_name: string; email: string | null }>,
  id: string | null | undefined,
) {
  const profile = profiles.find((item) => item.id === id);
  return profile?.display_name || profile?.email || (id ? "Usuário indisponível" : "—");
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

export function CorporateOwnershipPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const [entityId, setEntityId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [changeId, setChangeId] = useState("");
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [rejectChange, setRejectChange] = useState<OwnershipChange | null>(null);

  const workspace = useQuery({
    queryKey: ["corporate-ownership-workspace"],
    queryFn: listCorporateOwnershipWorkspace,
  });
  const readPermission = useQuery({
    queryKey: ["permission", "corporate_ownership.read"],
    queryFn: () => hasPermission("corporate_ownership.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "corporate_ownership.manage"],
    queryFn: () => hasPermission("corporate_ownership.manage"),
    enabled: Boolean(session && user),
  });
  const applyPermission = useQuery({
    queryKey: ["permission", "corporate_ownership.apply_changes"],
    queryFn: () => hasPermission("corporate_ownership.apply_changes"),
    enabled: Boolean(session && user),
  });

  const data = workspace.data;
  const canRead = Boolean(session && user && readPermission.data === true);
  const canManage = Boolean(session && user && managePermission.data === true);
  const canApply = Boolean(session && user && applyPermission.data === true);

  const selectedEntityId = data?.legalEntities.some((item) => item.id === entityId)
    ? entityId
    : (data?.legalEntities[0]?.id ?? "");
  const selectedEntity = data?.legalEntities.find((item) => item.id === selectedEntityId) ?? null;

  const entityStructures = useMemo(
    () => data?.capitalStructures.filter((item) => item.legal_entity_id === selectedEntityId) ?? [],
    [data?.capitalStructures, selectedEntityId],
  );
  const effectiveStructure = entityStructures.find((item) => item.status === "effective") ?? null;
  const selectedStructureId = entityStructures.some((item) => item.id === structureId)
    ? structureId
    : (effectiveStructure?.id ?? entityStructures[0]?.id ?? "");
  const selectedStructure =
    entityStructures.find((item) => item.id === selectedStructureId) ?? null;

  const structureClasses =
    data?.shareClasses.filter((item) => item.capital_structure_id === selectedStructureId) ?? [];
  const structurePositions =
    data?.positions.filter((item) => item.capital_structure_id === selectedStructureId) ?? [];
  const entityRoles = useMemo(
    () => data?.roles.filter((item) => item.legal_entity_id === selectedEntityId) ?? [],
    [data?.roles, selectedEntityId],
  );
  const entityDocuments = useMemo(
    () =>
      data?.documents.filter(
        (item) =>
          item.legal_entity_id === selectedEntityId &&
          !item.asset_id &&
          !item.legal_matter_id &&
          !item.compliance_obligation_id,
      ) ?? [],
    [data?.documents, selectedEntityId],
  );
  const entityResolutions = useMemo(
    () => data?.resolutions.filter((item) => item.legal_entity_id === selectedEntityId) ?? [],
    [data?.resolutions, selectedEntityId],
  );
  const entityChanges = useMemo(
    () => data?.changes.filter((item) => item.legal_entity_id === selectedEntityId) ?? [],
    [data?.changes, selectedEntityId],
  );
  const selectedChangeId = entityChanges.some((item) => item.id === changeId)
    ? changeId
    : (entityChanges[0]?.id ?? "");
  const selectedChange = entityChanges.find((item) => item.id === selectedChangeId) ?? null;
  const selectedChangeLines = useMemo(
    () => data?.changeLines.filter((item) => item.change_id === selectedChangeId) ?? [],
    [data?.changeLines, selectedChangeId],
  );
  const entityContributions = useMemo(
    () => data?.contributions.filter((item) => item.legal_entity_id === selectedEntityId) ?? [],
    [data?.contributions, selectedEntityId],
  );

  const sourceStructure = selectedChange?.source_capital_structure_id
    ? (entityStructures.find((item) => item.id === selectedChange.source_capital_structure_id) ??
      null)
    : null;
  const sourceClasses = sourceStructure
    ? (data?.shareClasses.filter((item) => item.capital_structure_id === sourceStructure.id) ?? [])
    : [];
  const sourcePositions = sourceStructure
    ? (data?.positions.filter((item) => item.capital_structure_id === sourceStructure.id) ?? [])
    : [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["corporate-ownership-workspace"] });
  };

  const changeWorkflow = useMutation({
    mutationFn: async (input: {
      kind: "submit" | "approve" | "apply";
      change: OwnershipChange;
    }) => {
      if (input.kind === "submit") {
        return submitOwnershipChange(input.change.id, input.change.version);
      }
      if (input.kind === "approve") {
        return decideOwnershipChange({
          changeId: input.change.id,
          expectedVersion: input.change.version,
          approve: true,
        });
      }
      return applyOwnershipChange(input.change.id, input.change.version);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Workflow societário concluído.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resolutionApproval = useMutation({
    mutationFn: (resolution: CorporateResolution) =>
      approveCorporateResolution(resolution.id, resolution.version),
    onSuccess: async () => {
      await refresh();
      toast.success("Deliberação aprovada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (
    workspace.isLoading ||
    (session &&
      user &&
      (readPermission.isLoading || managePermission.isLoading || applyPermission.isLoading))
  ) {
    return <LoadingState />;
  }

  if (workspace.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar Estrutura Societária</AlertTitle>
        <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
      </Alert>
    );
  }

  if (!selectedEntity) {
    return (
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertTitle>Nenhuma estrutura societária cadastrada</AlertTitle>
        <AlertDescription>
          Cadastre primeiro uma pessoa jurídica em Cadastros da Empresa. Este módulo controla o
          capital e a propriedade jurídica da Lander Solutions; participantes econômicos de produtos
          ou unidades são tratados pelos contratos, não aqui.
        </AlertDescription>
      </Alert>
    );
  }

  if (AUTHENTICATION_ENABLED && !user) {
    return (
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertTitle>Estrutura societária indisponível</AlertTitle>
        <AlertDescription>
          É necessário possuir sessão ativa e ao menos uma pessoa jurídica cadastrada.
        </AlertDescription>
      </Alert>
    );
  }

  const activePositions = structurePositions.filter(
    (item) => item.status === "active" && !item.effective_to,
  );
  const activeRoles = entityRoles.filter((item) => item.status === "active" && !item.effective_to);
  const openChanges = entityChanges.filter((item) =>
    ["draft", "submitted", "approved"].includes(item.status),
  ).length;
  const paidCapital = entityContributions
    .filter((item) => item.status === "confirmed")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const nextStructureVersion =
    Math.max(0, ...entityStructures.map((item) => Number(item.version_no))) + 1;

  return (
    <div className="space-y-4">
      {!canRead && !canManage && !canApply && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo consultivo</AlertTitle>
          <AlertDescription>
            O ledger societário está disponível para leitura. Cadastros e workflows exigem MFA e
            permissões específicas.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertTitle>Propriedade jurídica da empresa</AlertTitle>
        <AlertDescription>
          Controle a estrutura societária e o capital das entidades jurídicas da Lander Solutions.
          Esta área não cadastra automaticamente sócios ou participantes econômicos de Produtos e
          Unidades de Negócio.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-3">
        <div className="min-w-[280px] flex-1">
          <Select value={selectedEntityId} onValueChange={setEntityId}>
            <SelectTrigger className="max-w-xl">
              <SelectValue placeholder="Selecione a pessoa jurídica" />
            </SelectTrigger>
            <SelectContent>
              {data.legalEntities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.code} · {entity.trade_name || entity.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Capital vigente"
          value={
            effectiveStructure
              ? formatMoney(effectiveStructure.capital_amount, effectiveStructure.currency_code)
              : "Sem estrutura efetiva"
          }
          hint={
            effectiveStructure
              ? `Versão ${effectiveStructure.version_no}`
              : "Aguardando constituição"
          }
        />
        <Kpi
          label="Quotas atribuídas"
          value={formatQuantity(
            activePositions.reduce((sum, item) => sum + Number(item.quota_quantity), 0),
          )}
          hint={`${activePositions.length} posição(ões) vigentes`}
        />
        <Kpi
          label="Participantes ativos"
          value={String(new Set(activeRoles.map((item) => item.party_id)).size)}
          hint={`${activeRoles.length} vínculo(s) societário(s)`}
        />
        <Kpi
          label="Alterações abertas"
          value={String(openChanges)}
          hint={`${entityChanges.length} no histórico`}
        />
      </div>

      <Tabs defaultValue="capital" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
          <TabsTrigger value="capital">
            <Landmark className="h-4 w-4" /> Capital e quotas
          </TabsTrigger>
          <TabsTrigger value="participants">
            <UsersRound className="h-4 w-4" /> Sócios e administração
          </TabsTrigger>
          <TabsTrigger value="governance">
            <Gavel className="h-4 w-4" /> Documentos e deliberações
          </TabsTrigger>
          <TabsTrigger value="changes">
            <FileCheck2 className="h-4 w-4" /> Alterações
          </TabsTrigger>
          <TabsTrigger value="contributions">
            <WalletCards className="h-4 w-4" /> Integralizações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="capital" className="space-y-4">
          <Panel
            title="Estruturas de capital"
            description="Versões imutáveis da composição de capital da pessoa jurídica."
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <Select value={selectedStructureId} onValueChange={setStructureId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Selecione a versão" />
                </SelectTrigger>
                <SelectContent>
                  {entityStructures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      Versão {structure.version_no} · {structure.status} ·{" "}
                      {formatDate(structure.effective_from)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" disabled={!canManage} onClick={() => setModal("structure")}>
                  <Plus className="h-4 w-4" /> Nova estrutura
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canManage || selectedStructure?.status !== "draft"}
                  onClick={() => setModal("share-class")}
                >
                  <Plus className="h-4 w-4" /> Nova classe
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versão</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Total de quotas</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityStructures.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhuma estrutura cadastrada." />
                  )}
                  {entityStructures.map((structure) => (
                    <TableRow
                      key={structure.id}
                      className={
                        structure.id === selectedStructureId ? "bg-muted/50" : "cursor-pointer"
                      }
                      onClick={() => setStructureId(structure.id)}
                    >
                      <TableCell className="font-medium">{structure.version_no}</TableCell>
                      <TableCell>
                        {formatMoney(structure.capital_amount, structure.currency_code)}
                      </TableCell>
                      <TableCell>{formatQuantity(structure.total_quotas)}</TableCell>
                      <TableCell>
                        {formatDate(structure.effective_from)} —{" "}
                        {formatDate(structure.effective_to)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={structure.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel
            title="Classes de quotas"
            description="Direitos econômicos, voto e limites da versão selecionada."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Classe</TableHead>
                    <TableHead>Quotas autorizadas</TableHead>
                    <TableHead>Voto</TableHead>
                    <TableHead>Votos por quota</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structureClasses.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhuma classe nesta versão." />
                  )}
                  {structureClasses.map((shareClass) => (
                    <TableRow key={shareClass.id}>
                      <TableCell>
                        <p className="font-medium">
                          {shareClass.code} · {shareClass.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shareClass.description || "Sem descrição"}
                        </p>
                      </TableCell>
                      <TableCell>{formatQuantity(shareClass.authorized_quotas)}</TableCell>
                      <TableCell>{shareClass.voting_rights ? "Sim" : "Não"}</TableCell>
                      <TableCell>{formatQuantity(shareClass.votes_per_quota)}</TableCell>
                      <TableCell>
                        <StatusPill status={shareClass.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <Panel
            title="Posições societárias"
            description="Ledger derivado da versão de capital selecionada; não possui edição direta."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titular</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Quotas</TableHead>
                    <TableHead>Participação</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structurePositions.length === 0 && (
                    <EmptyRow colSpan={6} label="Nenhuma posição nesta versão." />
                  )}
                  {structurePositions.map((position) => {
                    const shareClass = data.shareClasses.find(
                      (item) => item.id === position.share_class_id,
                    );
                    const percentage = selectedStructure?.total_quotas
                      ? (Number(position.quota_quantity) / Number(selectedStructure.total_quotas)) *
                        100
                      : 0;
                    return (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">
                          {partyName(data.parties, position.holder_party_id)}
                        </TableCell>
                        <TableCell>{shareClass?.code || "—"}</TableCell>
                        <TableCell>{formatQuantity(position.quota_quantity)}</TableCell>
                        <TableCell>{percentage.toFixed(4)}%</TableCell>
                        <TableCell>
                          {formatDate(position.effective_from)} —{" "}
                          {formatDate(position.effective_to)}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={position.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel
            title="Vínculos societários e administrativos"
            description="Sócios, administradores, representantes e beneficiários finais."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Percentual final</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityRoles.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhum vínculo societário cadastrado." />
                  )}
                  {entityRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {partyName(data.parties, role.party_id)}
                      </TableCell>
                      <TableCell>{role.role_type}</TableCell>
                      <TableCell>
                        {role.ultimate_ownership_percentage === null
                          ? "—"
                          : `${role.ultimate_ownership_percentage}%`}
                      </TableCell>
                      <TableCell>
                        {formatDate(role.effective_from)} — {formatDate(role.effective_to)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={role.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Panel
            title="Evidências societárias"
            description="Contratos, alterações, atas, decisões e comprovantes verificáveis."
          >
            <div className="flex justify-end border-b p-3">
              <Button size="sm" disabled={!canManage} onClick={() => setModal("document")}>
                <Plus className="h-4 w-4" /> Nova evidência
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityDocuments.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhuma evidência societária cadastrada." />
                  )}
                  {entityDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <p className="font-medium">{document.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {document.checksum_sha256?.slice(0, 16) || "Sem checksum"}
                        </p>
                      </TableCell>
                      <TableCell>{document.document_type}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {document.external_reference || "Armazenamento interno"}
                      </TableCell>
                      <TableCell>
                        {formatDate(document.valid_from)} — {formatDate(document.valid_until)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={document.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel
            title="Deliberações"
            description="Atas, decisões e consentimentos com aprovação segregada."
          >
            <div className="flex justify-end border-b p-3">
              <Button size="sm" disabled={!canManage} onClick={() => setModal("resolution")}>
                <Plus className="h-4 w-4" /> Nova deliberação
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deliberação</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Aprovação</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityResolutions.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhuma deliberação cadastrada." />
                  )}
                  {entityResolutions.map((resolution) => (
                    <TableRow key={resolution.id}>
                      <TableCell>
                        <p className="font-medium">
                          {resolution.code} · {resolution.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {resolution.resolution_type}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(resolution.held_on)}</TableCell>
                      <TableCell>{profileName(data.profiles, resolution.approved_by)}</TableCell>
                      <TableCell>
                        <StatusPill status={resolution.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {resolution.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canApply || resolutionApproval.isPending}
                            onClick={() => resolutionApproval.mutate(resolution)}
                          >
                            Aprovar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="changes" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-card p-3">
            <div>
              <h2 className="font-semibold">Alterações societárias</h2>
              <p className="text-sm text-muted-foreground">
                Rascunho, submissão, aprovação independente e aplicação atômica.
              </p>
            </div>
            <Button size="sm" disabled={!canManage} onClick={() => setModal("change")}>
              <Plus className="h-4 w-4" /> Nova alteração
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]">
            <Panel title="Histórico" description="Selecione uma alteração para inspecionar.">
              <div className="divide-y">
                {entityChanges.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhuma alteração cadastrada.</p>
                ) : (
                  entityChanges.map((change) => (
                    <button
                      key={change.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 ${change.id === selectedChangeId ? "bg-muted/60" : ""}`}
                      onClick={() => setChangeId(change.id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{change.code}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {change.change_type} · {formatDate(change.effective_on)}
                        </p>
                      </div>
                      <StatusPill status={change.status} />
                    </button>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Memória da alteração" description="Linhas e trilha de aprovação.">
              {!selectedChange ? (
                <p className="p-6 text-sm text-muted-foreground">Selecione uma alteração.</p>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-sm border p-3">
                      <p className="text-xs text-muted-foreground">Solicitante</p>
                      <p className="mt-1 text-sm font-medium">
                        {profileName(data.profiles, selectedChange.requested_by)}
                      </p>
                    </div>
                    <div className="rounded-sm border p-3">
                      <p className="text-xs text-muted-foreground">Aprovador</p>
                      <p className="mt-1 text-sm font-medium">
                        {profileName(data.profiles, selectedChange.approved_by)}
                      </p>
                    </div>
                    <div className="rounded-sm border p-3">
                      <p className="text-xs text-muted-foreground">Executor</p>
                      <p className="mt-1 text-sm font-medium">
                        {profileName(data.profiles, selectedChange.applied_by)}
                      </p>
                    </div>
                    <div className="rounded-sm border p-3">
                      <p className="text-xs text-muted-foreground">Linhas</p>
                      <p className="mt-1 text-sm font-medium">{selectedChangeLines.length}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedChange.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage}
                          onClick={() => setModal("line")}
                        >
                          <Plus className="h-4 w-4" /> Incluir linha
                        </Button>
                        <Button
                          size="sm"
                          disabled={!canManage || changeWorkflow.isPending}
                          onClick={() =>
                            changeWorkflow.mutate({ kind: "submit", change: selectedChange })
                          }
                        >
                          Submeter
                        </Button>
                      </>
                    )}
                    {selectedChange.status === "submitted" && (
                      <>
                        <Button
                          size="sm"
                          disabled={!canApply || changeWorkflow.isPending}
                          onClick={() =>
                            changeWorkflow.mutate({ kind: "approve", change: selectedChange })
                          }
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canApply || changeWorkflow.isPending}
                          onClick={() => setRejectChange(selectedChange)}
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {selectedChange.status === "approved" && (
                      <Button
                        size="sm"
                        disabled={!canApply || changeWorkflow.isPending}
                        onClick={() =>
                          changeWorkflow.mutate({ kind: "apply", change: selectedChange })
                        }
                      >
                        Aplicar alteração
                      </Button>
                    )}
                    <Badge variant="outline">v{selectedChange.version}</Badge>
                  </div>

                  <div className="rounded-sm border bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Justificativa</p>
                    <p className="mt-1 text-muted-foreground">{selectedChange.justification}</p>
                    {selectedChange.decision_reason && (
                      <>
                        <p className="mt-3 font-medium">Decisão</p>
                        <p className="mt-1 text-muted-foreground">
                          {selectedChange.decision_reason}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-sm border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Operação</TableHead>
                          <TableHead>Titular</TableHead>
                          <TableHead>Classe</TableHead>
                          <TableHead>Quotas</TableHead>
                          <TableHead>Capital</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedChangeLines.length === 0 && (
                          <EmptyRow colSpan={6} label="Nenhuma linha incluída." />
                        )}
                        {selectedChangeLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.sequence_no}</TableCell>
                            <TableCell>{line.operation_type}</TableCell>
                            <TableCell>{partyName(data.parties, line.holder_party_id)}</TableCell>
                            <TableCell>
                              {data.shareClasses.find((item) => item.id === line.share_class_id)
                                ?.code || "—"}
                            </TableCell>
                            <TableCell>{formatQuantity(line.quota_delta)}</TableCell>
                            <TableCell>
                              {formatMoney(
                                line.capital_delta,
                                selectedEntity.functional_currency_code,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="contributions">
          <Panel
            title="Integralizações de capital"
            description="Ledger derivado de alterações societárias aplicadas."
          >
            <div className="grid gap-3 border-b p-3 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi
                label="Total confirmado"
                value={formatMoney(paidCapital, selectedEntity.functional_currency_code)}
                hint={`${entityContributions.filter((item) => item.status === "confirmed").length} lançamento(s)`}
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityContributions.length === 0 && (
                    <EmptyRow colSpan={5} label="Nenhuma integralização aplicada." />
                  )}
                  {entityContributions.map((contribution) => (
                    <TableRow key={contribution.id}>
                      <TableCell>{formatDate(contribution.contributed_on)}</TableCell>
                      <TableCell className="font-medium">
                        {partyName(data.parties, contribution.holder_party_id)}
                      </TableCell>
                      <TableCell>{contribution.contribution_type}</TableCell>
                      <TableCell>
                        {formatMoney(contribution.amount, contribution.currency_code)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={contribution.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      {modal === "structure" && (
        <StructureCreateDialog
          legalEntityId={selectedEntity.id}
          currencyCode={selectedEntity.functional_currency_code}
          nextVersion={nextStructureVersion}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {modal === "share-class" && selectedStructure?.status === "draft" && (
        <ShareClassCreateDialog
          structure={selectedStructure}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {user && modal === "document" && (
        <CorporateDocumentCreateDialog
          legalEntityId={selectedEntity.id}
          userId={user.id}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {user && modal === "resolution" && (
        <ResolutionCreateDialog
          legalEntityId={selectedEntity.id}
          documents={entityDocuments.filter((item) => item.status === "active")}
          userId={user.id}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {user && modal === "change" && (
        <OwnershipChangeCreateDialog
          legalEntityId={selectedEntity.id}
          structures={entityStructures.filter((item) =>
            ["draft", "effective"].includes(item.status),
          )}
          resolutions={entityResolutions.filter((item) =>
            ["approved", "applied"].includes(item.status),
          )}
          documents={entityDocuments.filter((item) => item.status === "active")}
          userId={user.id}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {user && modal === "line" && selectedChange?.status === "draft" && (
        <OwnershipChangeLineCreateDialog
          change={selectedChange}
          nextSequence={Math.max(0, ...selectedChangeLines.map((item) => item.sequence_no)) + 1}
          parties={data.parties.filter((item) => item.status === "active")}
          shareClasses={sourceClasses}
          positions={sourcePositions}
          userId={user.id}
          onClose={() => setModal(null)}
          onChanged={refresh}
        />
      )}
      {rejectChange && (
        <ReasonDialog
          title="Rejeitar alteração societária"
          description="A rejeição preservará a trilha de decisão e impedirá a aplicação deste registro."
          confirmLabel="Rejeitar"
          onClose={() => setRejectChange(null)}
          onConfirm={async (reason) => {
            await decideOwnershipChange({
              changeId: rejectChange.id,
              expectedVersion: rejectChange.version,
              approve: false,
              reason,
            });
            await refresh();
            toast.success("Alteração societária rejeitada.");
          }}
        />
      )}
    </div>
  );
}
