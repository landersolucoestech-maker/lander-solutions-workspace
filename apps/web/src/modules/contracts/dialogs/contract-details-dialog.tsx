import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
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
import type { ContractReferenceData } from "@/modules/contracts/reference-data-api";
import {
  activateContract,
  approveContractVersion,
  createContractRecord,
  deleteContractRecord,
  listContractAuditEvents,
  updateContractRecord,
  type ContractTable,
} from "@/modules/contracts/api";
import { ContractTemplatePreview } from "@/modules/contracts/components/contract-template-preview";
import type {
  Contract,
  ContractApproval,
  ContractAuditEvent,
  ContractDirectory,
  ContractDocument,
  ContractFormulaComponent,
  ContractObligation,
  ContractParticipant,
  ContractParty,
  ContractVersion,
} from "@/modules/contracts/types";
import type { PermissionSet } from "@/modules/contracts/pages/contracts-page";
import {
  errorMessage,
  formatDate,
  formatMoney,
  unitCodeFor,
} from "@/modules/contracts/pages/contracts-page";

type SubEntity = "party" | "version" | "component" | "participant" | "obligation" | "document";
type Subrecord =
  | ContractParty
  | ContractVersion
  | ContractFormulaComponent
  | ContractParticipant
  | ContractObligation
  | ContractDocument;

type ModalState =
  | { entity: SubEntity; action: "create" }
  | { entity: SubEntity; action: "view" | "edit" | "destroy"; record: Subrecord }
  | null;

export function ContractDetailsDialog({
  contract,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  contract: Contract | null;
  directory: ContractDirectory;
  structure: ContractReferenceData;
  permissions: PermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!contract) return null;
  return (
    <ContractDetailsContent
      key={`${contract.id}-${contract.version}`}
      contract={contract}
      directory={directory}
      structure={structure}
      permissions={permissions}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function ContractDetailsContent({
  contract,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  contract: Contract;
  directory: ContractDirectory;
  structure: ContractReferenceData;
  permissions: PermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const versions = useMemo(
    () =>
      directory.versions
        .filter((item) => item.contract_id === contract.id)
        .sort((a, b) => b.version_number - a.version_number),
    [contract.id, directory.versions],
  );
  const [selectedVersionId, setSelectedVersionId] = useState(
    versions.find((item) => item.status === "approved")?.id ?? versions[0]?.id ?? "",
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const selectedVersion =
    versions.find((item) => item.id === selectedVersionId) ?? versions[0] ?? null;
  const contractParties = directory.parties.filter((item) => item.contract_id === contract.id);
  const components = directory.components.filter(
    (item) => item.contract_version_id === selectedVersion?.id,
  );
  const participants = directory.participants.filter(
    (item) => item.contract_version_id === selectedVersion?.id,
  );
  const obligations = directory.obligations.filter(
    (item) => item.contract_version_id === selectedVersion?.id,
  );
  const documents = directory.documents.filter(
    (item) => item.contract_version_id === selectedVersion?.id,
  );
  const approvals = directory.approvals.filter(
    (item) => item.contract_version_id === selectedVersion?.id,
  );
  const selectedVersionEditable = selectedVersion
    ? editableVersionStatuses.has(selectedVersion.status)
    : false;
  const auditQuery = useQuery({
    queryKey: ["contract-audit-events", contract.id, versions.map((item) => item.id).join(",")],
    queryFn: () =>
      listContractAuditEvents(
        contract.id,
        versions.map((item) => item.id),
      ),
    enabled: permissions.auditRead,
  });
  const signers = signerSnapshots(selectedVersion?.signers_snapshot);
  const primaryParty = contractParties.find((item) => item.is_primary) ?? contractParties[0];
  const documentBody =
    selectedVersion?.rendered_body?.trim() || selectedVersion?.template_body_snapshot?.trim() || "";

  async function refresh() {
    await onChanged();
    await queryClient.invalidateQueries({ queryKey: ["contract-directory"] });
  }

  async function submitForReview(version: ContractVersion) {
    if (!userId) {
      toast.error("Sessão do solicitante não identificada.");
      return;
    }
    setAdminBusy(true);
    try {
      await updateContractRecord<ContractVersion>(
        "contract_versions",
        version.id,
        version.version,
        {
          status: "in_review",
          requested_by: userId,
        },
      );
      await refresh();
      toast.success("Versão enviada para revisão. Outro usuário autorizado deverá aprová-la.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdminBusy(false);
    }
  }

  async function approve(version: ContractVersion) {
    setAdminBusy(true);
    try {
      await approveContractVersion({ versionId: version.id, expectedVersion: version.version });
      await refresh();
      toast.success("Versão contratual aprovada e congelada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdminBusy(false);
    }
  }

  async function activate() {
    setAdminBusy(true);
    try {
      await activateContract({ contractId: contract.id, expectedVersion: contract.version });
      await refresh();
      toast.success("Contrato ativado com base na versão aprovada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(92vh,900px)] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[96vw]">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                {contract.title}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                <span>{contract.code}</span>
                <span>·</span>
                <span>{contractTypeLabel(contract.contract_type)}</span>
                <span>·</span>
                <span>{unitCodeFor(structure, contract.business_unit_id)}</span>
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill status={contractStatusLabel(contract.status)} />
              {selectedVersion && (
                <Badge variant="outline">v{selectedVersion.version_number}</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/15 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Label htmlFor="contract-version-selector">Versão visualizada</Label>
            <select
              id="contract-version-selector"
              value={selectedVersion?.id ?? ""}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              className="h-9 min-w-48 rounded-sm border bg-background px-3 text-sm"
            >
              {versions.length === 0 && <option value="">Sem versões</option>}
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version_number} — {versionStatusLabel(version.status)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.updateDraft && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModal({ entity: "version", action: "create" })}
              >
                <Plus /> Nova versão
              </Button>
            )}
            {selectedVersion && permissions.updateDraft && selectedVersion.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                disabled={adminBusy}
                onClick={() => void submitForReview(selectedVersion)}
              >
                <Send /> Enviar para revisão
              </Button>
            )}
            {selectedVersion &&
              permissions.approve &&
              selectedVersion.status === "in_review" &&
              selectedVersion.requested_by !== userId && (
                <Button
                  size="sm"
                  disabled={adminBusy}
                  onClick={() => void approve(selectedVersion)}
                >
                  <CheckCircle2 /> Aprovar versão
                </Button>
              )}
            {permissions.approve &&
              ["draft", "in_review", "pending_signature"].includes(contract.status) &&
              versions.some((version) => version.status === "approved") && (
                <Button size="sm" disabled={adminBusy} onClick={() => void activate()}>
                  <CheckCircle2 /> Ativar contrato
                </Button>
              )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 overflow-x-auto border-b">
            <TabsList className="h-auto min-w-max justify-start rounded-none bg-transparent p-0">
              <TabsTrigger value="overview" className="rounded-none px-4 py-3">
                Visão geral
              </TabsTrigger>
              <TabsTrigger value="documents" className="rounded-none px-4 py-3">
                Documento
              </TabsTrigger>
              <TabsTrigger value="parties" className="rounded-none px-4 py-3">
                Partes
              </TabsTrigger>
              <TabsTrigger value="signatures" className="rounded-none px-4 py-3">
                Assinaturas
              </TabsTrigger>
              <TabsTrigger value="versions" className="rounded-none px-4 py-3">
                Versões
              </TabsTrigger>
              <TabsTrigger value="conditions" className="rounded-none px-4 py-3">
                Condições
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none px-4 py-3">
                Histórico
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="overview" className="m-0 p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border bg-muted/15 p-4">
                  <h3 className="text-sm font-semibold">Identificação</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dados centrais utilizados para localizar e classificar o instrumento.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoCard label="Código" value={contract.code} />
                    <InfoCard label="Tipo" value={contractTypeLabel(contract.contract_type)} />
                    <InfoCard
                      label="Unidade"
                      value={unitCodeFor(structure, contract.business_unit_id)}
                    />
                    <InfoCard
                      label="Responsável"
                      value={responsibleName(directory, contract.responsible_user_id)}
                    />
                    {contract.product_id && (
                      <InfoCard label="Produto" value={scopeName(structure, contract)} />
                    )}
                    {contract.service_line_id && (
                      <InfoCard label="Serviço" value={scopeName(structure, contract)} />
                    )}
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/15 p-4">
                  <h3 className="text-sm font-semibold">Vigência e renovação</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Período de validade e regras de continuidade contratual.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoCard label="Início" value={formatDate(contract.starts_on)} />
                    <InfoCard label="Fim" value={formatDate(contract.ends_on)} />
                    <InfoCard
                      label="Renovação"
                      value={
                        contract.auto_renewal
                          ? `Automática · aviso de ${contract.renewal_notice_days} dias`
                          : "Não automática"
                      }
                    />
                    <InfoCard label="Situação" value={contractStatusLabel(contract.status)} />
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/15 p-4">
                  <h3 className="text-sm font-semibold">Condições financeiras</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valores, moeda, faturamento e regime de reconhecimento.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Valor"
                      value={
                        contract.base_amount === null
                          ? "—"
                          : formatMoney(Number(contract.base_amount), contract.currency_code)
                      }
                    />
                    <InfoCard label="Moeda" value={contract.currency_code} />
                    <InfoCard
                      label="Frequência"
                      value={contract.billing_frequency.replaceAll("_", " ")}
                    />
                    <InfoCard label="Regime" value={regimeLabel(contract.recognition_regime)} />
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/15 p-4">
                  <h3 className="text-sm font-semibold">Contraparte principal</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Contraparte e referências administrativas do contrato.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Nome"
                      value={
                        primaryParty
                          ? partyName(directory, primaryParty.party_id)
                          : "Não disponível"
                      }
                    />
                    <InfoCard
                      label="Papel"
                      value={
                        primaryParty ? partyRoleLabel(primaryParty.party_role) : "Não disponível"
                      }
                    />
                    <InfoCard
                      label="Documento"
                      value={
                        primaryParty
                          ? partyTaxId(directory, primaryParty.party_id)
                          : "Não disponível"
                      }
                    />
                    <InfoCard
                      label="Parte Lander"
                      value={legalEntityName(structure, contract.legal_entity_id)}
                    />
                    <div className="sm:col-span-2">
                      <InfoCard
                        label="Observações"
                        value={contract.notes ?? "Nenhuma observação."}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="signatures" className="m-0 p-4 sm:p-6">
              <Section
                title="Signatários definidos"
                description="Snapshot da versão selecionada. A presença nesta lista não representa assinatura concluída."
                canCreate={false}
              >
                {signers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Assinatura eletrônica não configurada para esta versão.
                  </div>
                ) : (
                  <div className="grid gap-3 p-3 sm:grid-cols-2">
                    {signers.map((signer, index) => (
                      <article
                        key={`${signer.email}-${index}`}
                        className="flex items-start gap-3 rounded-sm border p-3"
                      >
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{signer.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {signer.email || "E-mail não disponível"}
                          </p>
                          <Badge variant="outline" className="mt-2">
                            {signer.role || "Papel não informado"}
                          </Badge>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="parties" className="m-0 p-4 sm:p-6">
              <Section
                title="Partes do contrato"
                description="Contraparte, participantes, investidores, beneficiários e signatários."
                canCreate={permissions.updateDraft && editableContractStatuses.has(contract.status)}
                onCreate={() => setModal({ entity: "party", action: "create" })}
              >
                <ContractPartiesTable
                  records={contractParties}
                  directory={directory}
                  canEdit={permissions.updateDraft && editableContractStatuses.has(contract.status)}
                  onAction={setModal}
                />
              </Section>
            </TabsContent>

            <TabsContent value="versions" className="m-0 space-y-4 p-4 sm:p-6">
              <Section
                title={`Versões do contrato${selectedVersion ? ` · v${selectedVersion.version_number} selecionada` : ""}`}
                description="Termos econômicos aprovados são imutáveis."
                canCreate={false}
              >
                <ContractVersionsTable
                  records={versions}
                  directory={directory}
                  canEdit={permissions.updateDraft}
                  onAction={setModal}
                />
              </Section>
            </TabsContent>

            <TabsContent value="conditions" className="m-0 p-4 sm:p-6">
              <div className="space-y-4">
                <VersionRequired version={selectedVersion}>
                  <Section
                    title="Participações por versão"
                    description="Percentuais, prioridade, retenção, limites e elegibilidade."
                    canCreate={permissions.updateDraft && selectedVersionEditable}
                    onCreate={() => setModal({ entity: "participant", action: "create" })}
                  >
                    <RecordTable
                      entity="participant"
                      records={participants}
                      directory={directory}
                      canEdit={permissions.updateDraft && selectedVersionEditable}
                      onAction={setModal}
                    />
                    <div className="border-t p-3 text-right text-sm">
                      Total ativo:{" "}
                      <strong>{activeParticipantTotal(participants).toFixed(4)}%</strong>
                    </div>
                  </Section>
                </VersionRequired>

                <VersionRequired version={selectedVersion}>
                  <Section
                    title="Componentes tipados da fórmula"
                    description="Não existe campo para código livre, SQL, JavaScript ou expressão arbitrária."
                    canCreate={permissions.updateDraft && selectedVersionEditable}
                    onCreate={() => setModal({ entity: "component", action: "create" })}
                  >
                    <RecordTable
                      entity="component"
                      records={components}
                      directory={directory}
                      canEdit={permissions.updateDraft && selectedVersionEditable}
                      onAction={setModal}
                    />
                  </Section>
                </VersionRequired>

                <VersionRequired version={selectedVersion}>
                  <Section
                    title="Obrigações e SLA"
                    description="Entregas, pagamentos, relatórios, confidencialidade, avisos e conformidade."
                    canCreate={permissions.updateDraft && selectedVersionEditable}
                    onCreate={() => setModal({ entity: "obligation", action: "create" })}
                  >
                    <RecordTable
                      entity="obligation"
                      records={obligations}
                      directory={directory}
                      canEdit={permissions.updateDraft && selectedVersionEditable}
                      onAction={setModal}
                    />
                  </Section>
                </VersionRequired>

                <VersionRequired version={selectedVersion}>
                  <Section
                    title="Documentos administrativos"
                    description="Instrumento principal, aditivos, anexos, propostas e evidências."
                    canCreate={permissions.documentsManage && selectedVersionEditable}
                    onCreate={() => setModal({ entity: "document", action: "create" })}
                  >
                    <RecordTable
                      entity="document"
                      records={documents}
                      directory={directory}
                      canEdit={permissions.documentsManage && selectedVersionEditable}
                      onAction={setModal}
                    />
                  </Section>
                </VersionRequired>

                <Section
                  title="Aprovações"
                  description="Decisões persistidas para a versão selecionada."
                  canCreate={false}
                >
                  <ApprovalTable approvals={approvals} directory={directory} />
                </Section>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="m-0 space-y-5 bg-muted/15 p-3 sm:p-6">
              {selectedVersion ? (
                documentBody ? (
                  <ContractTemplatePreview
                    title={`${contract.title} · versão ${selectedVersion.version_number}`}
                    headerText=""
                    bodyText={documentBody}
                    footerText=""
                    showEmptyRegions={false}
                  />
                ) : (
                  <div className="rounded-sm border bg-card p-10 text-center text-sm text-muted-foreground">
                    Esta versão não possui conteúdo documental persistido.
                  </div>
                )
              ) : (
                <div className="rounded-sm border bg-card p-10 text-center text-sm text-muted-foreground">
                  Selecione uma versão para visualizar seu documento.
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="m-0 p-4 sm:p-6">
              <ContractHistory
                enabled={permissions.auditRead}
                loading={auditQuery.isLoading}
                error={auditQuery.error}
                events={auditQuery.data ?? []}
                directory={directory}
              />
            </TabsContent>
          </div>
        </Tabs>

        <SubrecordDialog
          state={modal}
          contract={contract}
          selectedVersion={selectedVersion}
          directory={directory}
          structure={structure}
          userId={userId}
          onClose={() => setModal(null)}
          onChanged={async () => {
            await refresh();
            setModal(null);
          }}
        />

        <DialogFooter className="shrink-0 border-t bg-card px-4 py-3 sm:px-6">
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalTable({
  approvals,
  directory,
}: {
  approvals: ContractApproval[];
  directory: ContractDirectory;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Decisão</th>
            <th className="px-4 py-2 text-left">Solicitante</th>
            <th className="px-4 py-2 text-left">Aprovador</th>
            <th className="px-4 py-2 text-left">Data</th>
            <th className="px-4 py-2 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {approvals.length === 0 && <EmptyRow colSpan={5} label="Nenhuma decisão registrada." />}
          {approvals.map((approval) => (
            <tr key={approval.id} className="border-t">
              <td className="px-4 py-3">
                <StatusPill status={approval.decision} />
              </td>
              <td className="px-4 py-3 text-xs">
                {responsibleName(directory, approval.requested_by)}
              </td>
              <td className="px-4 py-3 text-xs">
                {responsibleName(directory, approval.approver_user_id)}
              </td>
              <td className="px-4 py-3 text-xs">
                {formatTimestamp(approval.decided_at ?? approval.created_at)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {approval.decision_reason ?? "Não informado"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractHistory({
  enabled,
  loading,
  error,
  events,
  directory,
}: {
  enabled: boolean;
  loading: boolean;
  error: Error | null;
  events: ContractAuditEvent[];
  directory: ContractDirectory;
}) {
  if (!enabled) {
    return (
      <div className="rounded-sm border p-8 text-center text-sm text-muted-foreground">
        A trilha exige a permissão audit.read.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-sm border p-8 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando histórico…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-sm border p-8 text-center text-sm text-muted-foreground">
        Não foi possível consultar a trilha de auditoria.
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="rounded-sm border p-8 text-center text-sm text-muted-foreground">
        Nenhum evento de auditoria disponível para este contrato.
      </div>
    );
  }
  return (
    <ol className="relative ml-2 space-y-0 border-l" aria-label="Histórico real do contrato">
      {events.map((event) => (
        <li key={event.id} className="relative pb-6 pl-7 last:pb-0">
          <span className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-card">
            {event.entity_table === "contract_versions" ? (
              <History className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
          </span>
          <p className="text-sm font-medium">{auditEventLabel(event)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3 w-3" /> {formatTimestamp(event.occurred_at)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Responsável: {responsibleName(directory, event.actor_user_id)}
          </p>
          {Object.keys((event.metadata ?? {}) as object).length > 0 && (
            <details className="mt-2 rounded-sm border bg-muted/10 p-2 text-xs">
              <summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}

function auditEventLabel(event: ContractAuditEvent) {
  const action = event.action.toLowerCase();
  if (event.entity_table === "contract_versions") {
    if (action === "insert") return "Versão criada";
    if (action === "update") return "Versão atualizada";
    if (action === "delete") return "Versão removida";
  }
  if (action === "insert") return "Contrato criado";
  if (action === "update") return "Contrato atualizado";
  if (action === "delete") return "Contrato removido";
  return event.action;
}

function signerSnapshots(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.nome ?? "Não disponível");
    const email = String(record.email ?? "");
    const role = String(record.role ?? record.papel ?? "");
    return [{ name, email, role }];
  });
}

function Section({
  title,
  description,
  canCreate,
  onCreate,
  children,
}: {
  title: string;
  description: string;
  canCreate: boolean;
  onCreate?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-sm border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {canCreate && onCreate && (
          <Button size="sm" variant="outline" onClick={onCreate}>
            <Plus /> Criar
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function VersionRequired({
  version,
  children,
}: {
  version: ContractVersion | null;
  children: ReactNode;
}) {
  if (version) return children;
  return (
    <div className="rounded-sm border p-8 text-center text-sm text-muted-foreground">
      Crie uma versão contratual primeiro.
    </div>
  );
}

function RecordTable({
  entity,
  records,
  directory,
  canEdit,
  onAction,
}: {
  entity: SubEntity;
  records: Subrecord[];
  directory: ContractDirectory;
  canEdit: boolean;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Registro</th>
            <th className="px-4 py-2 text-left">Detalhe</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && <EmptyRow colSpan={4} label="Nenhum registro." />}
          {records.map((record) => {
            const editable = canEdit && recordEditable(entity, record);
            return (
              <tr key={record.id} className="border-t align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{recordTitle(entity, record, directory)}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {recordDetail(entity, record, directory)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={recordStatus(entity, record)} />
                </td>
                <td className="px-4 py-3">
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
                      disabled={!editable}
                      onClick={() => onAction({ entity, action: "edit", record })}
                    >
                      <Pencil /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!editable}
                      onClick={() => onAction({ entity, action: "destroy", record })}
                    >
                      <Trash2 /> Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContractPartiesTable({
  records,
  directory,
  canEdit,
  onAction,
}: {
  records: ContractParty[];
  directory: ContractDirectory;
  canEdit: boolean;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Parte</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2 text-left">Papel</th>
            <th className="px-4 py-2 text-left">Principal</th>
            <th className="px-4 py-2 text-left">Vigência</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && <EmptyRow colSpan={6} label="Nenhuma parte vinculada." />}
          {records.map((record) => {
            const option = directory.partyOptions.find((item) => item.id === record.party_id);
            const editable = canEdit && recordEditable("party", record);
            return (
              <tr key={record.id} className="border-t align-top">
                <td className="px-4 py-3 font-medium">{partyName(directory, record.party_id)}</td>
                <td className="px-4 py-3">
                  {option?.party_type === "person" ? "Pessoa física" : "Pessoa jurídica"}
                </td>
                <td className="px-4 py-3">{partyRoleLabel(record.party_role)}</td>
                <td className="px-4 py-3">{record.is_primary ? "Sim" : "Não"}</td>
                <td className="px-4 py-3">{`${formatDate(record.starts_on)} → ${formatDate(record.ends_on)}`}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction({ entity: "party", action: "view", record })}
                    >
                      <Eye /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => onAction({ entity: "party", action: "edit", record })}
                    >
                      <Pencil /> Editar
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContractVersionsTable({
  records,
  directory,
  canEdit,
  onAction,
}: {
  records: ContractVersion[];
  directory: ContractDirectory;
  canEdit: boolean;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Versão</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-left">Criada em</th>
            <th className="px-4 py-2 text-left">Aprovação</th>
            <th className="px-4 py-2 text-left">Observações</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && <EmptyRow colSpan={6} label="Nenhuma versão registrada." />}
          {records.map((record) => {
            const editable = canEdit && recordEditable("version", record);
            return (
              <tr key={record.id} className="border-t align-top">
                <td className="px-4 py-3 font-medium">v{record.version_number}</td>
                <td className="px-4 py-3">
                  <StatusPill status={versionStatusLabel(record.status)} />
                </td>
                <td className="px-4 py-3 text-xs">{formatTimestamp(record.created_at)}</td>
                <td className="px-4 py-3 text-xs">
                  {record.approved_at || record.approved_by ? (
                    <>
                      <p>{responsibleName(directory, record.approved_by)}</p>
                      <p className="text-muted-foreground">
                        {record.approved_at
                          ? formatTimestamp(record.approved_at)
                          : "Data não disponível"}
                      </p>
                    </>
                  ) : (
                    "Não aprovada"
                  )}
                </td>
                <td className="max-w-72 px-4 py-3 text-muted-foreground">
                  {record.change_reason || "Não informado"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction({ entity: "version", action: "view", record })}
                    >
                      <Eye /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => onAction({ entity: "version", action: "edit", record })}
                    >
                      <Pencil /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!editable}
                      onClick={() => onAction({ entity: "version", action: "destroy", record })}
                    >
                      <Trash2 /> Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SubrecordDialog({
  state,
  contract,
  selectedVersion,
  directory,
  structure,
  userId,
  onClose,
  onChanged,
}: {
  state: ModalState;
  contract: Contract;
  selectedVersion: ContractVersion | null;
  directory: ContractDirectory;
  structure: ContractReferenceData;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!state) return null;
  if (state.action === "view") {
    return (
      <ViewSubrecordDialog
        state={state as { entity: SubEntity; action: "view"; record: Subrecord }}
        directory={directory}
        onClose={onClose}
      />
    );
  }
  if (state.action === "destroy") {
    return (
      <DestroySubrecordDialog
        key={`${state.entity}-${state.record.id}-${"version" in state.record ? state.record.version : 0}`}
        state={state as { entity: SubEntity; action: "destroy"; record: Subrecord }}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <SubrecordForm
      key={
        state.action === "create"
          ? `${state.entity}-new-${selectedVersion?.id ?? contract.id}`
          : `${state.entity}-${state.record.id}-${"version" in state.record ? state.record.version : 0}`
      }
      entity={state.entity}
      record={state.action === "edit" ? state.record : null}
      contract={contract}
      selectedVersion={selectedVersion}
      directory={directory}
      structure={structure}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function SubrecordForm({
  entity,
  record,
  contract,
  selectedVersion,
  directory,
  structure,
  userId,
  onClose,
  onChanged,
}: {
  entity: SubEntity;
  record: Subrecord | null;
  contract: Contract;
  selectedVersion: ContractVersion | null;
  directory: ContractDirectory;
  structure: ContractReferenceData;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const initial = initialFormValues(entity, record, contract, selectedVersion, directory, userId);
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const [submitting, setSubmitting] = useState(false);

  function set(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const table = entityTable(entity);
      const payload = buildPayload(entity, values, contract, selectedVersion, record, userId);
      if (record) {
        if (!("version" in record))
          throw new Error("Registro sem versão para controle de concorrência.");
        await updateContractRecord(table, record.id, record.version, payload);
      } else {
        await createContractRecord(table, payload);
      }
      await onChanged();
      toast.success(record ? "Registro atualizado." : "Registro criado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {record ? "Editar" : "Criar"} {entityLabel(entity)}
            </DialogTitle>
            <DialogDescription>{entityDescription(entity)}</DialogDescription>
          </DialogHeader>
          <EntityFields
            entity={entity}
            values={values}
            set={set}
            directory={directory}
            structure={structure}
          />
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

function EntityFields({
  entity,
  values,
  set,
  directory,
  structure,
}: {
  entity: SubEntity;
  values: Record<string, string | boolean>;
  set: (name: string, value: string | boolean) => void;
  directory: ContractDirectory;
  structure: ContractReferenceData;
}) {
  const text = (name: string) => String(values[name] ?? "");
  const checked = (name: string) => Boolean(values[name]);

  if (entity === "party") {
    return (
      <>
        <SelectField
          label="Cadastro"
          value={text("party_id")}
          onChange={(value) => set("party_id", value)}
          options={directory.partyOptions.map((item) => [
            item.id,
            item.trade_name || item.legal_name,
          ])}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Papel"
            value={text("party_role")}
            onChange={(value) => set("party_role", value)}
            options={partyRoleOptions}
          />
          <SelectField
            label="Situação"
            value={text("status")}
            onChange={(value) => set("status", value)}
            options={activeEndedOptions}
          />
          <CheckboxField
            label="Contraparte principal"
            checked={checked("is_primary")}
            onChange={(value) => set("is_primary", value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Início"
            type="date"
            value={text("starts_on")}
            onChange={(value) => set("starts_on", value)}
          />
          <TextField
            label="Fim"
            type="date"
            value={text("ends_on")}
            onChange={(value) => set("ends_on", value)}
          />
        </div>
        <TextAreaField
          label="Observações"
          value={text("notes")}
          onChange={(value) => set("notes", value)}
        />
      </>
    );
  }

  if (entity === "version") {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Número"
            type="number"
            min="1"
            value={text("version_number")}
            onChange={(value) => set("version_number", value)}
            required
          />
          <TextField
            label="Início da vigência"
            type="date"
            value={text("effective_from")}
            onChange={(value) => set("effective_from", value)}
            required
          />
          <TextField
            label="Fim da vigência"
            type="date"
            value={text("effective_to")}
            onChange={(value) => set("effective_to", value)}
          />
        </div>
        <TextAreaField
          label="Motivo da versão"
          value={text("change_reason")}
          onChange={(value) => set("change_reason", value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Base de cálculo"
            value={text("calculation_basis")}
            onChange={(value) => set("calculation_basis", value)}
            options={calculationBasisOptions}
          />
          <SelectField
            label="Regra de prejuízo"
            value={text("loss_rule")}
            onChange={(value) => set("loss_rule", value)}
            options={lossRuleOptions}
          />
          <SelectField
            label="Regra de investimento"
            value={text("investment_rule")}
            onChange={(value) => set("investment_rule", value)}
            options={investmentRuleOptions}
          />
          <SelectField
            label="Método de reserva"
            value={text("reserve_method")}
            onChange={(value) => set("reserve_method", value)}
            options={reserveMethodOptions}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Valor da reserva"
            type="number"
            min="0"
            step="0.01"
            value={text("reserve_value")}
            onChange={(value) => set("reserve_value", value)}
          />
          <TextField
            label="Casas de arredondamento"
            type="number"
            min="0"
            max="6"
            value={text("rounding_scale")}
            onChange={(value) => set("rounding_scale", value)}
            required
          />
          <TextField
            label="Prazo de pagamento (dias)"
            type="number"
            min="0"
            max="3650"
            value={text("payment_term_days")}
            onChange={(value) => set("payment_term_days", value)}
            required
          />
        </div>
        <CheckboxField
          label="Permitir bases distintas entre participantes"
          checked={checked("allows_distinct_bases")}
          onChange={(value) => set("allows_distinct_bases", value)}
        />
      </>
    );
  }

  if (entity === "component") {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Sequência"
            type="number"
            min="1"
            max="1000"
            value={text("sequence_no")}
            onChange={(value) => set("sequence_no", value)}
            required
          />
          <SelectField
            label="Componente"
            value={text("component_type")}
            onChange={(value) => set("component_type", value)}
            options={componentTypeOptions}
          />
          <SelectField
            label="Operação"
            value={text("operation")}
            onChange={(value) => set("operation", value)}
            options={operationOptions}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Reconhecimento"
            value={text("recognition_basis")}
            onChange={(value) => set("recognition_basis", value)}
            options={recognitionBasisOptions}
          />
          <SelectField
            label="Escopo do filtro"
            value={text("filter_scope")}
            onChange={(value) => set("filter_scope", value)}
            options={filterScopeOptions}
          />
          <TextField
            label="Valor do filtro"
            value={text("filter_value")}
            onChange={(value) => set("filter_value", value)}
          />
        </div>
        <SelectField
          label="Situação"
          value={text("status")}
          onChange={(value) => set("status", value)}
          options={activeInactiveOptions}
        />
        <TextAreaField
          label="Descrição"
          value={text("description")}
          onChange={(value) => set("description", value)}
        />
      </>
    );
  }

  if (entity === "participant") {
    return (
      <>
        <SelectField
          label="Participante"
          value={text("party_id")}
          onChange={(value) => set("party_id", value)}
          options={directory.partyOptions.map((item) => [
            item.id,
            item.trade_name || item.legal_name,
          ])}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Percentual"
            type="number"
            min="0.000001"
            max="100"
            step="0.000001"
            value={text("percentage")}
            onChange={(value) => set("percentage", value)}
            required
          />
          <TextField
            label="Prioridade"
            type="number"
            min="1"
            max="10000"
            value={text("priority")}
            onChange={(value) => set("priority", value)}
            required
          />
          <TextField
            label="Retenção (%)"
            type="number"
            min="0"
            max="100"
            step="0.000001"
            value={text("retention_percentage")}
            onChange={(value) => set("retention_percentage", value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Mínimo"
            type="number"
            min="0"
            step="0.01"
            value={text("minimum_amount")}
            onChange={(value) => set("minimum_amount", value)}
          />
          <TextField
            label="Máximo"
            type="number"
            min="0"
            step="0.01"
            value={text("maximum_amount")}
            onChange={(value) => set("maximum_amount", value)}
          />
          <SelectField
            label="Situação"
            value={text("status")}
            onChange={(value) => set("status", value)}
            options={participantStatusOptions}
          />
        </div>
        <TextAreaField
          label="Condição de elegibilidade"
          value={text("eligibility_condition")}
          onChange={(value) => set("eligibility_condition", value)}
        />
      </>
    );
  }

  if (entity === "obligation") {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Tipo"
            value={text("obligation_type")}
            onChange={(value) => set("obligation_type", value)}
            options={obligationTypeOptions}
          />
          <TextField
            label="Título"
            value={text("title")}
            onChange={(value) => set("title", value)}
            required
          />
        </div>
        <TextAreaField
          label="Descrição"
          value={text("description")}
          onChange={(value) => set("description", value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Responsável"
            value={text("responsible_party_id")}
            onChange={(value) => set("responsible_party_id", value)}
            options={[
              ["", "Sem parte responsável"],
              ...directory.partyOptions.map(
                (item) => [item.id, item.trade_name || item.legal_name] as const,
              ),
            ]}
          />
          <SelectField
            label="Regra de vencimento"
            value={text("due_rule")}
            onChange={(value) => set("due_rule", value)}
            options={dueRuleOptions}
          />
          <TextField
            label="Data de vencimento"
            type="date"
            value={text("due_date")}
            onChange={(value) => set("due_date", value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Recorrência"
            value={text("recurrence")}
            onChange={(value) => set("recurrence", value)}
            options={recurrenceOptions}
          />
          <TextField
            label="Valor"
            type="number"
            min="0"
            step="0.01"
            value={text("amount")}
            onChange={(value) => set("amount", value)}
          />
          <SelectField
            label="Moeda"
            value={text("currency_code")}
            onChange={(value) => set("currency_code", value)}
            options={[
              ["", "Sem valor financeiro"],
              ...structure.currencies.map((item) => [item.code, item.code] as const),
            ]}
          />
        </div>
        <SelectField
          label="Situação"
          value={text("status")}
          onChange={(value) => set("status", value)}
          options={obligationStatusOptions}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          value={text("document_type")}
          onChange={(value) => set("document_type", value)}
          options={documentTypeOptions}
        />
        <TextField
          label="Rótulo"
          value={text("label")}
          onChange={(value) => set("label", value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Armazenamento"
          value={text("storage_provider")}
          onChange={(value) => set("storage_provider", value)}
          options={storageProviderOptions}
        />
        <SelectField
          label="Situação"
          value={text("status")}
          onChange={(value) => set("status", value)}
          options={documentStatusOptions}
        />
        <TextField
          label="Bucket"
          value={text("storage_bucket")}
          onChange={(value) => set("storage_bucket", value)}
        />
        <TextField
          label="Chave do objeto"
          value={text("storage_object_key")}
          onChange={(value) => set("storage_object_key", value)}
        />
      </div>
      <TextField
        label="Referência externa"
        value={text("external_reference")}
        onChange={(value) => set("external_reference", value)}
      />
      <TextField
        label="SHA-256"
        value={text("checksum_sha256")}
        onChange={(value) => set("checksum_sha256", value)}
      />
    </>
  );
}

function ViewSubrecordDialog({
  state,
  directory,
  onClose,
}: {
  state: { entity: SubEntity; action: "view"; record: Subrecord };
  directory: ContractDirectory;
  onClose: () => void;
}) {
  const fields = viewFields(state.entity, state.record, directory);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ver {entityLabel(state.entity)}</DialogTitle>
          <DialogDescription>Registro persistido e auditável.</DialogDescription>
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

function DestroySubrecordDialog({
  state,
  onClose,
  onChanged,
}: {
  state: { entity: SubEntity; action: "destroy"; record: Subrecord };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = deleteConfirmation(state.entity, state.record);
  const allowed = recordEditable(state.entity, state.record);

  async function destroy() {
    setSubmitting(true);
    try {
      if (!allowed)
        throw new Error(
          "Registro consolidado não pode ser excluído; crie uma nova versão ou reversão formal.",
        );
      await deleteContractRecord(entityTable(state.entity), state.record.id);
      await onChanged();
      toast.success("Registro excluído do rascunho.");
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
          <DialogTitle>Excluir {entityLabel(state.entity)}</DialogTitle>
          <DialogDescription>
            Somente registros pertencentes a rascunhos podem ser removidos fisicamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="subrecord-delete-confirmation">Digite {expected} para confirmar</Label>
          <Input
            id="subrecord-delete-confirmation"
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
            disabled={!allowed || submitting || confirmation !== expected}
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />} Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initialFormValues(
  entity: SubEntity,
  record: Subrecord | null,
  contract: Contract,
  selectedVersion: ContractVersion | null,
  directory: ContractDirectory,
  userId: string | null,
): Record<string, string | boolean> {
  if (entity === "party") {
    const item = record as ContractParty | null;
    return {
      party_id: item?.party_id ?? directory.partyOptions[0]?.id ?? "",
      party_role: item?.party_role ?? "counterparty",
      is_primary: item?.is_primary ?? false,
      status: item?.status ?? "active",
      starts_on: item?.starts_on ?? contract.starts_on ?? "",
      ends_on: item?.ends_on ?? "",
      notes: item?.notes ?? "",
    };
  }
  if (entity === "version") {
    const item = record as ContractVersion | null;
    return {
      version_number: String(item?.version_number ?? nextVersionNumber(directory, contract.id)),
      effective_from:
        item?.effective_from ?? contract.starts_on ?? new Date().toISOString().slice(0, 10),
      effective_to: item?.effective_to ?? "",
      change_reason: item?.change_reason ?? "Versão inicial do contrato",
      calculation_basis: item?.calculation_basis ?? "gross_revenue",
      loss_rule: item?.loss_rule ?? "no_future_effect",
      investment_rule: item?.investment_rule ?? "non_recoverable",
      reserve_method: item?.reserve_method ?? "none",
      reserve_value: item?.reserve_value?.toString() ?? "",
      rounding_scale: String(item?.rounding_scale ?? 2),
      allows_distinct_bases: item?.allows_distinct_bases ?? false,
      payment_term_days: String(item?.payment_term_days ?? 10),
      requested_by: item?.requested_by ?? userId ?? "",
    };
  }
  if (!selectedVersion) throw new Error("Selecione ou crie uma versão contratual.");
  if (entity === "component") {
    const item = record as ContractFormulaComponent | null;
    return {
      sequence_no: String(item?.sequence_no ?? nextSequence(directory, selectedVersion.id)),
      component_type: item?.component_type ?? "product_revenue",
      operation: item?.operation ?? "include",
      recognition_basis: item?.recognition_basis ?? "contract",
      filter_scope: item?.filter_scope ?? "all",
      filter_value: item?.filter_value ?? "",
      description: item?.description ?? "",
      status: item?.status ?? "active",
    };
  }
  if (entity === "participant") {
    const item = record as ContractParticipant | null;
    return {
      party_id: item?.party_id ?? directory.partyOptions[0]?.id ?? "",
      percentage: item?.percentage?.toString() ?? "",
      priority: String(item?.priority ?? 100),
      minimum_amount: item?.minimum_amount?.toString() ?? "",
      maximum_amount: item?.maximum_amount?.toString() ?? "",
      retention_percentage: String(item?.retention_percentage ?? 0),
      eligibility_condition: item?.eligibility_condition ?? "",
      status: item?.status ?? "active",
    };
  }
  if (entity === "obligation") {
    const item = record as ContractObligation | null;
    return {
      obligation_type: item?.obligation_type ?? "delivery",
      title: item?.title ?? "",
      description: item?.description ?? "",
      responsible_party_id: item?.responsible_party_id ?? "",
      due_rule: item?.due_rule ?? "manual",
      due_date: item?.due_date ?? "",
      recurrence: item?.recurrence ?? "none",
      amount: item?.amount?.toString() ?? "",
      currency_code: item?.currency_code ?? "",
      status: item?.status ?? "active",
    };
  }
  const item = record as ContractDocument | null;
  return {
    document_type: item?.document_type ?? "main_contract",
    label: item?.label ?? "",
    storage_provider: item?.storage_provider ?? "none",
    storage_bucket: item?.storage_bucket ?? "",
    storage_object_key: item?.storage_object_key ?? "",
    external_reference: item?.external_reference ?? "",
    checksum_sha256: item?.checksum_sha256 ?? "",
    status: item?.status ?? "pending",
  };
}

function buildPayload(
  entity: SubEntity,
  values: Record<string, string | boolean>,
  contract: Contract,
  selectedVersion: ContractVersion | null,
  record: Subrecord | null,
  userId: string | null,
): Record<string, unknown> {
  const text = (name: string) => String(values[name] ?? "").trim();
  const optional = (name: string) => text(name) || null;
  const number = (name: string) => Number(text(name));
  const optionalNumber = (name: string) => (text(name) === "" ? null : Number(text(name)));

  if (entity === "party") {
    return {
      contract_id: contract.id,
      party_id: text("party_id"),
      party_role: text("party_role"),
      is_primary: Boolean(values.is_primary),
      status: text("status"),
      starts_on: optional("starts_on"),
      ends_on: optional("ends_on"),
      notes: optional("notes"),
    };
  }
  if (entity === "version") {
    const current = record as ContractVersion | null;
    return {
      contract_id: contract.id,
      version_number: number("version_number"),
      effective_from: text("effective_from"),
      effective_to: optional("effective_to"),
      change_reason: text("change_reason"),
      calculation_basis: text("calculation_basis"),
      included_components: current?.included_components ?? [],
      excluded_components: current?.excluded_components ?? [],
      loss_rule: text("loss_rule"),
      investment_rule: text("investment_rule"),
      reserve_method: text("reserve_method"),
      reserve_value: optionalNumber("reserve_value"),
      rounding_scale: number("rounding_scale"),
      allows_distinct_bases: Boolean(values.allows_distinct_bases),
      payment_term_days: number("payment_term_days"),
      status: current?.status ?? "draft",
      requested_by: current?.requested_by ?? userId,
      approved_by: current?.approved_by ?? null,
      approved_at: current?.approved_at ?? null,
    };
  }
  if (!selectedVersion) throw new Error("Versão contratual obrigatória.");
  if (entity === "component") {
    const scope = text("filter_scope");
    return {
      contract_version_id: selectedVersion.id,
      sequence_no: number("sequence_no"),
      component_type: text("component_type"),
      operation: text("operation"),
      recognition_basis: text("recognition_basis"),
      filter_scope: scope,
      filter_value: scope === "all" ? null : optional("filter_value"),
      description: optional("description"),
      status: text("status"),
    };
  }
  if (entity === "participant") {
    return {
      contract_version_id: selectedVersion.id,
      party_id: text("party_id"),
      percentage: number("percentage"),
      priority: number("priority"),
      minimum_amount: optionalNumber("minimum_amount"),
      maximum_amount: optionalNumber("maximum_amount"),
      retention_percentage: number("retention_percentage"),
      eligibility_condition: optional("eligibility_condition"),
      status: text("status"),
    };
  }
  if (entity === "obligation") {
    const amount = optionalNumber("amount");
    return {
      contract_version_id: selectedVersion.id,
      obligation_type: text("obligation_type"),
      title: text("title"),
      description: text("description"),
      responsible_party_id: optional("responsible_party_id"),
      due_rule: text("due_rule"),
      due_date: optional("due_date"),
      recurrence: text("recurrence"),
      amount,
      currency_code: amount === null ? null : text("currency_code"),
      status: text("status"),
    };
  }
  return {
    contract_version_id: selectedVersion.id,
    document_type: text("document_type"),
    label: text("label"),
    storage_provider: text("storage_provider"),
    storage_bucket: optional("storage_bucket"),
    storage_object_key: optional("storage_object_key"),
    external_reference: optional("external_reference"),
    checksum_sha256: optional("checksum_sha256"),
    status: text("status"),
    verified_by: (record as ContractDocument | null)?.verified_by ?? null,
    verified_at: (record as ContractDocument | null)?.verified_at ?? null,
  };
}

function entityTable(entity: SubEntity): ContractTable {
  return {
    party: "contract_parties",
    version: "contract_versions",
    component: "contract_formula_components",
    participant: "contract_version_participants",
    obligation: "contract_obligations",
    document: "contract_documents",
  }[entity] as ContractTable;
}

function recordEditable(entity: SubEntity, record: Subrecord): boolean {
  if (entity === "version") return editableVersionStatuses.has((record as ContractVersion).status);
  return true;
}

function recordTitle(entity: SubEntity, record: Subrecord, directory: ContractDirectory): string {
  if (entity === "party") return partyName(directory, (record as ContractParty).party_id);
  if (entity === "version") return `Versão ${(record as ContractVersion).version_number}`;
  if (entity === "component")
    return componentTypeLabel((record as ContractFormulaComponent).component_type);
  if (entity === "participant")
    return partyName(directory, (record as ContractParticipant).party_id);
  if (entity === "obligation") return (record as ContractObligation).title;
  return (record as ContractDocument).label;
}

function recordDetail(entity: SubEntity, record: Subrecord, directory: ContractDirectory): string {
  if (entity === "party") return partyRoleLabel((record as ContractParty).party_role);
  if (entity === "version")
    return `${formatDate((record as ContractVersion).effective_from)} · ${calculationBasisLabel((record as ContractVersion).calculation_basis)}`;
  if (entity === "component") {
    const item = record as ContractFormulaComponent;
    return `${operationLabel(item.operation)} · ${item.filter_scope === "all" ? "todos" : `${item.filter_scope}: ${item.filter_value}`}`;
  }
  if (entity === "participant") {
    const item = record as ContractParticipant;
    return `${Number(item.percentage).toFixed(4)}% · retenção ${Number(item.retention_percentage).toFixed(4)}%`;
  }
  if (entity === "obligation") {
    const item = record as ContractObligation;
    return `${obligationTypeLabel(item.obligation_type)} · responsável ${item.responsible_party_id ? partyName(directory, item.responsible_party_id) : "não definido"}`;
  }
  const item = record as ContractDocument;
  return `${documentTypeLabel(item.document_type)} · ${item.storage_provider}`;
}

function recordStatus(entity: SubEntity, record: Subrecord): string {
  if (entity === "version") return versionStatusLabel((record as ContractVersion).status);
  return String((record as { status: string }).status);
}

function viewFields(
  entity: SubEntity,
  record: Subrecord,
  directory: ContractDirectory,
): Array<[string, string]> {
  const common: Array<[string, string]> = [["Situação", recordStatus(entity, record)]];
  if (entity === "party") {
    const item = record as ContractParty;
    return [
      ["Parte", partyName(directory, item.party_id)],
      ["Papel", partyRoleLabel(item.party_role)],
      ["Principal", item.is_primary ? "Sim" : "Não"],
      ["Vigência", `${formatDate(item.starts_on)} → ${formatDate(item.ends_on)}`],
      ["Observações", item.notes ?? "—"],
      ...common,
    ];
  }
  if (entity === "version") {
    const item = record as ContractVersion;
    return [
      ["Versão", String(item.version_number)],
      ["Vigência", `${formatDate(item.effective_from)} → ${formatDate(item.effective_to)}`],
      ["Base", calculationBasisLabel(item.calculation_basis)],
      ["Prejuízo", item.loss_rule],
      ["Investimento", item.investment_rule],
      ["Prazo", `${item.payment_term_days} dias`],
      ["Motivo", item.change_reason],
      ...common,
    ];
  }
  if (entity === "component") {
    const item = record as ContractFormulaComponent;
    return [
      ["Sequência", String(item.sequence_no)],
      ["Componente", componentTypeLabel(item.component_type)],
      ["Operação", operationLabel(item.operation)],
      ["Reconhecimento", item.recognition_basis],
      ["Filtro", `${item.filter_scope}: ${item.filter_value ?? "todos"}`],
      ["Descrição", item.description ?? "—"],
      ...common,
    ];
  }
  if (entity === "participant") {
    const item = record as ContractParticipant;
    return [
      ["Participante", partyName(directory, item.party_id)],
      ["Percentual", `${item.percentage}%`],
      ["Prioridade", String(item.priority)],
      ["Retenção", `${item.retention_percentage}%`],
      ["Mínimo", item.minimum_amount?.toString() ?? "—"],
      ["Máximo", item.maximum_amount?.toString() ?? "—"],
      ["Elegibilidade", item.eligibility_condition ?? "—"],
      ...common,
    ];
  }
  if (entity === "obligation") {
    const item = record as ContractObligation;
    return [
      ["Tipo", obligationTypeLabel(item.obligation_type)],
      ["Título", item.title],
      ["Descrição", item.description],
      [
        "Responsável",
        item.responsible_party_id ? partyName(directory, item.responsible_party_id) : "—",
      ],
      ["Vencimento", `${item.due_rule} · ${formatDate(item.due_date)}`],
      ["Recorrência", item.recurrence],
      [
        "Valor",
        item.amount === null || !item.currency_code
          ? "—"
          : formatMoney(Number(item.amount), item.currency_code),
      ],
      ...common,
    ];
  }
  const item = record as ContractDocument;
  return [
    ["Tipo", documentTypeLabel(item.document_type)],
    ["Rótulo", item.label],
    ["Armazenamento", item.storage_provider],
    ["Bucket", item.storage_bucket ?? "—"],
    ["Objeto", item.storage_object_key ?? "—"],
    ["Referência externa", item.external_reference ?? "—"],
    ["SHA-256", item.checksum_sha256 ?? "—"],
    ...common,
  ];
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
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
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
        max={max}
        step={step}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={4000}
        className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
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

const editableVersionStatuses = new Set(["draft", "in_review", "rejected"]);
const editableContractStatuses = new Set(["draft", "in_review", "pending_signature"]);

const partyRoleOptions = options({
  counterparty: "Contraparte",
  client: "Cliente",
  supplier: "Fornecedor",
  participant: "Participante",
  investor: "Investidor",
  beneficiary: "Beneficiário",
  guarantor: "Garantidor",
  signatory: "Signatário",
  service_provider: "Prestador",
  other: "Outro",
});
const activeEndedOptions = options({ active: "Ativo", inactive: "Inativo", ended: "Encerrado" });
const activeInactiveOptions = options({ active: "Ativo", inactive: "Inativo" });
const participantStatusOptions = options({
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
});
const calculationBasisOptions = options({
  gross_revenue: "Faturamento bruto",
  revenue_after_discounts: "Receita após descontos",
  revenue_after_refunds: "Receita após reembolsos",
  net_revenue: "Receita líquida",
  selected_revenue: "Receitas selecionadas",
  result_after_direct_costs: "Resultado após custos diretos",
  result_after_exclusive_expenses: "Resultado após despesas exclusivas",
  result_after_authorized_allocations: "Resultado após rateios autorizados",
  operating_profit: "Lucro operacional",
  managerial_net_profit: "Lucro líquido gerencial",
  typed_composition: "Composição tipada",
});
const lossRuleOptions = options({
  absorbed_by_company: "Absorvido pela empresa",
  shared: "Compartilhado",
  reduce_future_bases: "Reduz bases futuras",
  offset_future_profits: "Compensa lucros futuros",
  limited_offset: "Compensação limitada",
  no_future_effect: "Sem efeito futuro",
});
const investmentRuleOptions = options({
  non_recoverable: "Não recuperável",
  recover_before_split: "Recuperar antes da divisão",
  recover_in_installments: "Recuperar em parcelas",
  advance: "Adiantamento",
  contractual_loan: "Empréstimo contratual",
  participant_expense: "Despesa do participante",
  result_reinvestment: "Reinvestimento",
  operational_reserve: "Reserva operacional",
});
const reserveMethodOptions = options({
  none: "Sem reserva",
  percentage: "Percentual",
  fixed_amount: "Valor fixo",
  formula_component: "Componente da fórmula",
});
const componentTypeOptions = options({
  product_revenue: "Receita do produto",
  plan_revenue: "Receita por plano",
  channel_revenue: "Receita por canal",
  country_revenue: "Receita por país",
  currency_revenue: "Receita por moeda",
  discounts: "Descontos",
  cancellations: "Cancelamentos",
  refunds: "Reembolsos",
  chargebacks: "Chargebacks",
  taxes: "Impostos",
  payment_fees: "Taxas de pagamento",
  direct_costs: "Custos diretos",
  exclusive_expenses: "Despesas exclusivas",
  shared_expenses: "Despesas compartilhadas",
  recoverable_investments: "Investimentos recuperáveis",
  reserves: "Reservas",
  contingencies: "Contingências",
  reinvestments: "Reinvestimentos",
  accumulated_losses: "Prejuízos acumulados",
  specific_revenue: "Receita específica",
  specific_expense: "Despesa específica",
  advances: "Adiantamentos",
  compensations: "Compensações",
});
const operationOptions = options({
  include: "Incluir",
  exclude: "Excluir",
  add: "Adicionar",
  deduct: "Deduzir",
  reserve: "Reservar",
});
const recognitionBasisOptions = options({
  contract: "Regime do contrato",
  COMPETENCIA: "Competência",
  CAIXA: "Caixa",
});
const filterScopeOptions = options({
  all: "Todos",
  product: "Produto",
  plan: "Plano",
  channel: "Canal",
  country: "País",
  currency: "Moeda",
  category: "Categoria",
  project: "Projeto",
});
const obligationTypeOptions = options({
  delivery: "Entrega",
  payment: "Pagamento",
  reporting: "Relatório",
  sla: "SLA",
  confidentiality: "Confidencialidade",
  compliance: "Conformidade",
  renewal: "Renovação",
  notice: "Aviso",
  other: "Outro",
});
const dueRuleOptions = options({
  manual: "Manual",
  fixed_date: "Data fixa",
  days_after_period: "Dias após período",
  days_after_invoice: "Dias após invoice",
  recurring: "Recorrente",
});
const recurrenceOptions = options({
  none: "Sem recorrência",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
});
const obligationStatusOptions = options({
  active: "Ativa",
  fulfilled: "Cumprida",
  waived: "Dispensada",
  breached: "Descumprida",
  inactive: "Inativa",
});
const documentTypeOptions = options({
  main_contract: "Contrato principal",
  amendment: "Aditivo",
  annex: "Anexo",
  proposal: "Proposta",
  signature_evidence: "Evidência de assinatura",
  approval_evidence: "Evidência de aprovação",
  other: "Outro",
});
const storageProviderOptions = options({
  none: "Sem arquivo",
  r2: "Cloudflare R2",
  supabase: "Supabase Storage",
  external: "Referência externa",
});
const documentStatusOptions = options({
  pending: "Pendente",
  uploaded: "Enviado",
  verified: "Verificado",
  superseded: "Substituído",
  inactive: "Inativo",
});

function options(values: Record<string, string>): Array<readonly [string, string]> {
  return Object.entries(values);
}

function entityLabel(entity: SubEntity): string {
  return {
    party: "parte",
    version: "versão",
    component: "componente",
    participant: "participação",
    obligation: "obrigação",
    document: "documento",
  }[entity];
}

function entityDescription(entity: SubEntity): string {
  return {
    party: "Vincule uma pessoa ou organização ao contrato.",
    version: "Crie uma nova versão econômica; versões aprovadas nunca são sobrescritas.",
    component: "Configure um componente tipado da memória de cálculo.",
    participant: "Defina percentual, prioridade, retenções e limites.",
    obligation: "Registre uma obrigação contratual rastreável.",
    document: "Vincule metadados e referência de armazenamento do documento.",
  }[entity];
}

function partyName(directory: ContractDirectory, partyId: string): string {
  const party = directory.partyOptions.find((item) => item.id === partyId);
  return party?.trade_name || party?.legal_name || "Cadastro indisponível";
}

function partyTaxId(directory: ContractDirectory, partyId: string): string {
  return directory.partyOptions.find((item) => item.id === partyId)?.tax_id ?? "Não disponível";
}

function nextVersionNumber(directory: ContractDirectory, contractId: string): number {
  return (
    Math.max(
      0,
      ...directory.versions
        .filter((item) => item.contract_id === contractId)
        .map((item) => item.version_number),
    ) + 1
  );
}

function nextSequence(directory: ContractDirectory, versionId: string): number {
  return (
    Math.max(
      0,
      ...directory.components
        .filter((item) => item.contract_version_id === versionId)
        .map((item) => item.sequence_no),
    ) + 1
  );
}

function activeParticipantTotal(items: ContractParticipant[]): number {
  return items
    .filter((item) => item.status === "active")
    .reduce((sum, item) => sum + Number(item.percentage), 0);
}

function deleteConfirmation(entity: SubEntity, record: Subrecord): string {
  if (entity === "version") return `V${(record as ContractVersion).version_number}`;
  if (entity === "party") return partyRoleLabel((record as ContractParty).party_role);
  return record.id.slice(0, 8);
}

function contractStatusLabel(value: string): string {
  return (
    {
      draft: "rascunho",
      in_review: "em revisão",
      pending_signature: "em assinatura",
      active: "ativo",
      renewal: "renovação",
      expired: "expirado",
      terminated: "encerrado",
      cancelled: "cancelado",
    }[value] ?? value
  );
}

function versionStatusLabel(value: string): string {
  return (
    {
      draft: "rascunho",
      in_review: "em revisão",
      approved: "aprovada",
      superseded: "substituída",
      rejected: "rejeitada",
    }[value] ?? value
  );
}

function contractTypeLabel(value: string): string {
  return (
    {
      client: "Cliente",
      supplier: "Fornecedor",
      service: "Prestação de serviço",
      participation: "Participação econômica",
      investment: "Investimento",
      partnership: "Parceria",
      nda: "Confidencialidade",
      employment: "Trabalho",
      other: "Outro",
    }[value] ?? value
  );
}

function regimeLabel(value: string): string {
  return (
    { COMPETENCIA: "Competência", CAIXA: "Caixa", HIBRIDO_CONTRATUAL: "Híbrido contratual" }[
      value
    ] ?? value
  );
}

function scopeName(structure: ContractReferenceData, contract: Contract): string {
  if (contract.product_id)
    return (
      structure.products.find((item) => item.id === contract.product_id)?.name ?? "Produto removido"
    );
  if (contract.service_line_id)
    return (
      structure.serviceLines.find((item) => item.id === contract.service_line_id)?.name ??
      "Serviço removido"
    );
  return "Escopo geral da unidade";
}

function legalEntityName(structure: ContractReferenceData, legalEntityId: string): string {
  const entity = structure.legalEntities.find((item) => item.id === legalEntityId);
  return entity?.trade_name || entity?.legal_name || "Não disponível";
}

function responsibleName(directory: ContractDirectory, userId: string | null): string {
  if (!userId) return "Não disponível";
  const profile = directory.profiles.find((item) => item.id === userId);
  return profile?.display_name || profile?.email || "Não disponível";
}

function partyRoleLabel(value: string): string {
  return partyRoleOptions.find(([key]) => key === value)?.[1] ?? value;
}
function calculationBasisLabel(value: string): string {
  return calculationBasisOptions.find(([key]) => key === value)?.[1] ?? value;
}
function componentTypeLabel(value: string): string {
  return componentTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}
function operationLabel(value: string): string {
  return operationOptions.find(([key]) => key === value)?.[1] ?? value;
}
function obligationTypeLabel(value: string): string {
  return obligationTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}
function documentTypeLabel(value: string): string {
  return documentTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
