import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, PlugZap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/shared/components/ui/textarea";
import { EmptyRow, Kpi, PageHeader, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import {
  createIntegration,
  deleteIntegration,
  listIntegrationDirectory,
  updateIntegration,
} from "./api";
import type {
  IntegrationConnection,
  IntegrationEnvironment,
  IntegrationFormInput,
  IntegrationStatus,
} from "./types";

const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

interface FormState {
  businessUnitId: string;
  sourceSystem: string;
  informationType: string;
  endpointUrl: string;
  environment: IntegrationEnvironment;
  status: IntegrationStatus;
  lastSyncAt: string;
  lastFailureAt: string;
  lastFailureMessage: string;
  technicalOwnerUserId: string;
  secretReference: string;
  summaryLog: string;
}

const emptyForm: FormState = {
  businessUnitId: "",
  sourceSystem: "",
  informationType: "",
  endpointUrl: "",
  environment: "development",
  status: "draft",
  lastSyncAt: "",
  lastFailureAt: "",
  lastFailureMessage: "",
  technicalOwnerUserId: "",
  secretReference: "",
  summaryLog: "",
};

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["settings-integrations"],
    queryFn: listIntegrationDirectory,
  });
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<IntegrationConnection | "create" | null>(null);
  const [detail, setDetail] = useState<IntegrationConnection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationConnection | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<void>) => operation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings-integrations"] });
      toast.success("Integração atualizada.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a integração.");
    },
  });

  const data = query.data;
  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data.connections;

    return data.connections.filter((row) =>
      [
        row.source_system,
        row.information_type,
        row.endpoint_url,
        row.environment,
        row.status,
        row.last_failure_message,
        row.summary_log,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  if (query.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando integrações…</p>;
  }

  if (query.isError || !data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Configurações de integrações"
          description="Não foi possível consultar o cadastro técnico de integrações."
        />
        <Panel title="Falha de consulta">
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const active = data.connections.filter((row) => row.status === "active").length;
  const failed = data.connections.filter((row) => row.status === "error").length;
  const neverSynced = data.connections.filter((row) => !row.last_sync_at).length;

  function openEditor(row?: IntegrationConnection) {
    if (!row) {
      setForm(emptyForm);
      setEditor("create");
      return;
    }

    setForm({
      businessUnitId: row.business_unit_id ?? "",
      sourceSystem: row.source_system,
      informationType: row.information_type,
      endpointUrl: row.endpoint_url ?? "",
      environment: row.environment,
      status: row.status,
      lastSyncAt: toDateTimeLocal(row.last_sync_at),
      lastFailureAt: toDateTimeLocal(row.last_failure_at),
      lastFailureMessage: row.last_failure_message ?? "",
      technicalOwnerUserId: row.technical_owner_user_id ?? "",
      secretReference: row.secret_reference ?? "",
      summaryLog: row.summary_log ?? "",
    });
    setEditor(row);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = toInput(form);

    if (editor === "create") {
      await mutation.mutateAsync(() => createIntegration(input));
    } else if (editor) {
      await mutation.mutateAsync(() => updateIntegration(editor.id, editor.version, input));
    }
    setEditor(null);
  }

  async function remove() {
    if (!deleteTarget) return;
    await mutation.mutateAsync(() => deleteIntegration(deleteTarget.id, deleteTarget.version));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de integrações"
        description="Cadastro técnico mínimo de fluxos concretos que alimentam a gestão empresarial. Não administra assinaturas, tenants, usuários, permissões internas ou operações dos produtos."
        actions={
          data.canManage ? (
            <Button onClick={() => openEditor()}>
              <Plus /> Cadastrar integração
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Integrações cadastradas" value={String(data.connections.length)} />
        <Kpi
          label="Cadastros ativos"
          value={String(active)}
          tone="positive"
          hint="Não comprova conexão sem sincronização"
        />
        <Kpi label="Com falha" value={String(failed)} tone={failed > 0 ? "warning" : "neutral"} />
        <Kpi
          label="Nunca sincronizadas"
          value={String(neverSynced)}
          tone={neverSynced > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="rounded-sm border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Escopo controlado:</strong> esta área registra somente
        sistema de origem, informação recebida, endpoint, ambiente, situação, sincronizações,
        falhas, responsável técnico e referência externa do segredo. Credenciais nunca devem ser
        armazenadas aqui.
      </div>

      <Panel
        title="Integrações"
        description="Somente fluxos com necessidade empresarial concreta devem ser cadastrados."
        actions={
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar sistema, informação, ambiente ou falha"
            className="h-9 w-full min-w-72 rounded-sm"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-2 text-left font-semibold">Origem</th>
                <th className="px-4 py-2 text-left font-semibold">Informação recebida</th>
                <th className="px-4 py-2 text-left font-semibold">Escopo</th>
                <th className="px-4 py-2 text-left font-semibold">Ambiente</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Última sincronização</th>
                <th className="px-4 py-2 text-left font-semibold">Última falha</th>
                <th className="px-4 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <EmptyRow
                  colSpan={8}
                  label="Nenhuma integração corresponde à busca. Cadastre somente uma conexão externa real quando origem, finalidade e endpoint estiverem definidos."
                />
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.source_system}</p>
                    <p className="mt-1 max-w-72 break-all text-xs text-muted-foreground">
                      {row.endpoint_url ?? "Endpoint ainda não informado"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.information_type}</td>
                  <td className="px-4 py-3">
                    <UnitTag>{unitName(data.businessUnits, row.business_unit_id)}</UnitTag>
                  </td>
                  <td className="px-4 py-3">{environmentLabel(row.environment)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusLabel(row.status)} />
                  </td>
                  <td className="num px-4 py-3 text-muted-foreground">
                    {formatDateTime(row.last_sync_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="num text-muted-foreground">
                      {formatDateTime(row.last_failure_at)}
                    </p>
                    {row.last_failure_message ? (
                      <p className="mt-1 max-w-64 text-xs text-destructive">
                        {row.last_failure_message}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
                        <Eye /> Ver
                      </Button>
                      {data.canManage ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEditor(row)}>
                            <Pencil /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 /> Excluir
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editor === "create" ? "Cadastrar integração" : "Editar integração"}
              </DialogTitle>
              <DialogDescription>
                Registre somente metadados do fluxo. Tokens, chaves e senhas devem permanecer no
                cofre de segredos e ser citados apenas por referência.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sistema de origem">
                <Input
                  value={form.sourceSystem}
                  onChange={(event) => setForm({ ...form, sourceSystem: event.target.value })}
                  required
                />
              </Field>
              <Field label="Tipo de informação recebida">
                <Input
                  value={form.informationType}
                  onChange={(event) => setForm({ ...form, informationType: event.target.value })}
                  placeholder="Ex.: receita consolidada do período"
                  required
                />
              </Field>
              <Field label="Unidade ou produto relacionado">
                <select
                  className={fieldClass}
                  value={form.businessUnitId}
                  onChange={(event) => setForm({ ...form, businessUnitId: event.target.value })}
                >
                  <option value="">Escopo corporativo global</option>
                  {data.businessUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Responsável técnico">
                <select
                  className={fieldClass}
                  value={form.technicalOwnerUserId}
                  onChange={(event) =>
                    setForm({ ...form, technicalOwnerUserId: event.target.value })
                  }
                >
                  <option value="">Não definido</option>
                  {data.technicalOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ambiente">
                <select
                  className={fieldClass}
                  value={form.environment}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      environment: event.target.value as IntegrationEnvironment,
                    })
                  }
                >
                  <option value="development">Desenvolvimento</option>
                  <option value="staging">Homologação</option>
                  <option value="production">Produção</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as IntegrationStatus })
                  }
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                  <option value="error">Com erro</option>
                </select>
              </Field>
              <Field label="Endpoint" className="md:col-span-2">
                <Input
                  type="url"
                  value={form.endpointUrl}
                  onChange={(event) => setForm({ ...form, endpointUrl: event.target.value })}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Referência do segredo" className="md:col-span-2">
                <Input
                  value={form.secretReference}
                  onChange={(event) => setForm({ ...form, secretReference: event.target.value })}
                  placeholder="Ex.: vault://integrations/music-os-360/finance-webhook"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Nunca cole token, chave, senha ou conteúdo de credencial.
                </p>
              </Field>
              <Field label="Última sincronização">
                <Input
                  type="datetime-local"
                  value={form.lastSyncAt}
                  onChange={(event) => setForm({ ...form, lastSyncAt: event.target.value })}
                />
              </Field>
              <Field label="Última falha">
                <Input
                  type="datetime-local"
                  value={form.lastFailureAt}
                  onChange={(event) => setForm({ ...form, lastFailureAt: event.target.value })}
                />
              </Field>
              <Field label="Descrição da última falha" className="md:col-span-2">
                <Textarea
                  value={form.lastFailureMessage}
                  onChange={(event) => setForm({ ...form, lastFailureMessage: event.target.value })}
                  rows={3}
                />
              </Field>
              <Field label="Log resumido" className="md:col-span-2">
                <Textarea
                  value={form.summaryLog}
                  onChange={(event) => setForm({ ...form, summaryLog: event.target.value })}
                  rows={4}
                  placeholder="Resumo operacional sem payload sensível."
                />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5" /> {detail?.source_system}
            </DialogTitle>
            <DialogDescription>{detail?.information_type}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <Detail
                label="Escopo"
                value={unitName(data.businessUnits, detail.business_unit_id)}
              />
              <Detail label="Ambiente" value={environmentLabel(detail.environment)} />
              <Detail label="Status" value={statusLabel(detail.status)} />
              <Detail
                label="Responsável técnico"
                value={ownerName(data.technicalOwners, detail.technical_owner_user_id)}
              />
              <Detail label="Endpoint" value={detail.endpoint_url ?? "Não informado"} />
              <Detail
                label="Referência do segredo"
                value={detail.secret_reference ?? "Não informada"}
              />
              <Detail label="Última sincronização" value={formatDateTime(detail.last_sync_at)} />
              <Detail label="Última falha" value={formatDateTime(detail.last_failure_at)} />
              <Detail
                label="Descrição da falha"
                value={detail.last_failure_message ?? "Sem falha registrada"}
                className="md:col-span-2"
              />
              <Detail
                label="Log resumido"
                value={detail.summary_log ?? "Sem log resumido"}
                className="md:col-span-2"
              />
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir integração</DialogTitle>
            <DialogDescription>
              O registro será inativado e excluído logicamente. A auditoria será preservada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => void remove()}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-foreground">{value}</dd>
    </div>
  );
}

function toInput(form: FormState): IntegrationFormInput {
  return {
    businessUnitId: form.businessUnitId || null,
    sourceSystem: form.sourceSystem.trim(),
    informationType: form.informationType.trim(),
    endpointUrl: form.endpointUrl.trim() || null,
    environment: form.environment,
    status: form.status,
    lastSyncAt: toIso(form.lastSyncAt),
    lastFailureAt: toIso(form.lastFailureAt),
    lastFailureMessage: form.lastFailureMessage.trim() || null,
    technicalOwnerUserId: form.technicalOwnerUserId || null,
    secretReference: form.secretReference.trim() || null,
    summaryLog: form.summaryLog.trim() || null,
  };
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function unitName(options: Array<{ id: string; code?: string; name: string }>, id: string | null) {
  if (!id) return "GLOBAL";
  const option = options.find((item) => item.id === id);
  return option?.code ?? option?.name ?? id;
}

function ownerName(options: Array<{ id: string; name: string }>, id: string | null) {
  if (!id) return "Não definido";
  return options.find((item) => item.id === id)?.name ?? id;
}

function environmentLabel(value: IntegrationEnvironment) {
  return {
    development: "Desenvolvimento",
    staging: "Homologação",
    production: "Produção",
  }[value];
}

function statusLabel(value: IntegrationStatus) {
  return {
    draft: "rascunho",
    active: "ativo",
    inactive: "inactive",
    error: "erro",
  }[value];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada.";
}
