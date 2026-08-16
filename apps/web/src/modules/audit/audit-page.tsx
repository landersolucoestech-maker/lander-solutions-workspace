import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";

import { EmptyRow, Kpi, PageHeader, Panel, StatusPill } from "@/shared/components/ui-kit";
import { useAuth } from "@/app/providers/auth-context";
import { hasPermission } from "@/modules/access-control/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { getAuditSummary, listAuditEntityTables, listAuditEvents } from "./api";
import type { AuditEvent, AuditFilters, AuditJsonValue } from "./types";

const initialFilters: AuditFilters = {
  search: "",
  action: "",
  entityTable: "",
  actorUserId: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 50,
};

const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function shortId(value: string | null, length = 12) {
  if (!value) return "Sistema";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function isJsonObject(value: AuditJsonValue | null): value is Record<string, AuditJsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function changedKeys(event: AuditEvent) {
  const before = event.before_data;
  const after = event.after_data;
  if (!isJsonObject(before) || !isJsonObject(after)) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function JsonBlock({ title, value }: { title: string; value: AuditJsonValue | null }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      <pre className="max-h-72 overflow-auto rounded-sm border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
        {value === null ? "Sem dados." : JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export function AuditPage() {
  const { session, user } = useAuth();
  const permission = useQuery({
    queryKey: ["permission", "audit.read"],
    queryFn: () => hasPermission("audit.read"),
    enabled: Boolean(session && user),
  });
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["audit-events", filters],
    queryFn: () => listAuditEvents(filters),
    placeholderData: (previous) => previous,
  });
  const summaryQuery = useQuery({ queryKey: ["audit-summary"], queryFn: getAuditSummary });
  const tablesQuery = useQuery({
    queryKey: ["audit-entity-tables"],
    queryFn: listAuditEntityTables,
  });

  const result = eventsQuery.data;
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const firstRow = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const lastRow = Math.min(filters.page * filters.pageSize, total);
  const actorsOnPage = useMemo(
    () => new Set((result?.events ?? []).map((event) => event.actor_user_id).filter(Boolean)).size,
    [result?.events],
  );

  if (session && user && permission.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Validando acesso à auditoria...</p>;
  }
  if (!session || !user || permission.data !== true) {
    return (
      <Alert>
        <AlertTitle>Acesso restrito</AlertTitle>
        <AlertDescription>A consulta de eventos exige a permissão audit.read.</AlertDescription>
      </Alert>
    );
  }

  const updateFilter = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? Number(value) : 1,
    }));
  };

  const error = eventsQuery.error ?? summaryQuery.error ?? tablesQuery.error;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Trilha de auditoria"
        description="Consulte quem fez o quê, quando e em qual registro. Dados anteriores, posteriores e identificadores técnicos ficam disponíveis no detalhe."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Eventos registrados"
          value={String(summaryQuery.data?.total ?? 0)}
          hint="Histórico completo"
        />
        <Kpi label="Inclusões" value={String(summaryQuery.data?.inserts ?? 0)} />
        <Kpi label="Alterações" value={String(summaryQuery.data?.updates ?? 0)} />
        <Kpi label="Exclusões registradas" value={String(summaryQuery.data?.deletes ?? 0)} />
        <Kpi label="Atores na página" value={String(actorsOnPage)} />
      </div>

      <Panel title="Filtros" description="A consulta respeita a permissão global `audit.read`.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Busca">
            <Input
              placeholder="Ação, tabela, entidade ou request ID"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </Field>
          <Field label="Ação">
            <select
              className={fieldClass}
              value={filters.action}
              onChange={(event) => updateFilter("action", event.target.value)}
            >
              <option value="">Todas</option>
              <option value="insert">Inclusão</option>
              <option value="update">Alteração</option>
              <option value="delete">Exclusão</option>
            </select>
          </Field>
          <Field label="Tabela">
            <select
              className={fieldClass}
              value={filters.entityTable}
              onChange={(event) => updateFilter("entityTable", event.target.value)}
            >
              <option value="">Todas</option>
              {(tablesQuery.data ?? []).map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Usuário responsável">
            <Input
              placeholder="UUID do ator"
              value={filters.actorUserId}
              onChange={(event) => updateFilter("actorUserId", event.target.value.trim())}
            />
          </Field>
          <Field label="Data inicial">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field label="Data final">
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
          <Field label="Registros por página">
            <select
              className={fieldClass}
              value={String(filters.pageSize)}
              onChange={(event) => updateFilter("pageSize", Number(event.target.value))}
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => setFilters(initialFilters)}>
              <RotateCcw className="h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        </div>
      </Panel>

      {error && (
        <p className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Falha ao carregar a trilha de auditoria."}
        </p>
      )}

      <Panel
        title="Eventos"
        description={
          eventsQuery.isFetching
            ? "Atualizando consulta..."
            : `${firstRow}–${lastRow} de ${total} registros, em ordem cronológica decrescente.`
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Data e hora</th>
                <th className="px-4 py-3">Ator</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Entidade</th>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {!eventsQuery.isLoading && (result?.events.length ?? 0) === 0 && (
                <EmptyRow
                  colSpan={7}
                  label="Nenhum evento encontrado para os filtros informados."
                />
              )}
              {(result?.events ?? []).map((event) => (
                <tr key={event.id} className="border-t align-top">
                  <td className="px-4 py-3 font-mono text-xs">#{event.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {localDateTime(event.occurred_at)}
                  </td>
                  <td className="px-4 py-3">
                    <p
                      className="font-mono text-xs"
                      title={event.actor_user_id ?? "Ação do sistema"}
                    >
                      {shortId(event.actor_user_id)}
                    </p>
                    {event.actor_session_id && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        sessão {shortId(event.actor_session_id, 8)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={event.action} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {event.entity_schema}.{event.entity_table}
                    </p>
                    <p className="mt-1 max-w-64 truncate font-mono text-[11px] text-muted-foreground">
                      {event.entity_id ?? "sem identificador individual"}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {shortId(event.request_id, 16)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Ver evento"
                      aria-label="Ver evento"
                      onClick={() => setSelected(event)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Página {filters.page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1 || eventsQuery.isFetching}
              onClick={() => updateFilter("page", filters.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= pageCount || eventsQuery.isFetching}
              onClick={() => updateFilter("page", filters.page + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Panel>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Evento de auditoria #{selected?.id}</DialogTitle>
            <DialogDescription>
              Registro imutável. Os dados abaixo são exibidos exatamente como foram persistidos.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Data e hora" value={localDateTime(selected.occurred_at)} />
                <Detail label="Ação" value={selected.action} />
                <Detail
                  label="Entidade"
                  value={`${selected.entity_schema}.${selected.entity_table}`}
                />
                <Detail label="ID da entidade" value={selected.entity_id ?? "—"} mono />
                <Detail label="Ator" value={selected.actor_user_id ?? "Sistema"} mono />
                <Detail label="Sessão" value={selected.actor_session_id ?? "—"} mono />
                <Detail label="Request ID" value={selected.request_id ?? "—"} mono />
                <Detail
                  label="Campos alterados"
                  value={changedKeys(selected).join(", ") || "Não aplicável"}
                />
              </dl>
              <div className="grid gap-4 lg:grid-cols-2">
                <JsonBlock title="Antes" value={selected.before_data} />
                <JsonBlock title="Depois" value={selected.after_data} />
              </div>
              <JsonBlock title="Metadados" value={selected.metadata} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-sm border p-3">
      <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={`mt-1 break-all text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
