import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FilePlus2, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyRow, Kpi, PageHeader, StatusPill } from "@/shared/components/ui-kit";
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
import {
  closeLegalMatter,
  createLegalEvent,
  createLegalMatter,
  deleteLegalEvent,
  deleteLegalMatter,
  listLegalWorkspace,
  updateLegalEvent,
  updateLegalMatter,
} from "./api";
import type { LegalMatter, LegalMatterEvent } from "./types";

const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";
const pageSize = 10;

const matterTypes = [
  ["analysis", "Análise jurídica"],
  ["contract_review", "Questão contratual"],
  ["notice", "Notificação"],
  ["claim", "Reclamação"],
  ["litigation", "Processo judicial"],
  ["administrative", "Processo administrativo"],
  ["labor", "Trabalhista"],
  ["tax", "Tributário"],
  ["intellectual_property", "Conflito de propriedade intelectual"],
  ["privacy", "Privacidade"],
  ["consumer", "Consumidor"],
  ["negotiation", "Negociação"],
  ["other", "Outro"],
] as const;

const statuses = [
  ["draft", "Rascunho"],
  ["open", "Aberto"],
  ["awaiting_response", "Aguardando resposta"],
  ["under_review", "Em análise"],
  ["settled", "Acordado"],
  ["won", "Favorável"],
  ["lost", "Desfavorável"],
  ["closed", "Encerrado"],
  ["cancelled", "Cancelado"],
] as const;

const riskLevels = [
  ["low", "Baixo"],
  ["medium", "Médio"],
  ["high", "Alto"],
  ["critical", "Crítico"],
] as const;

interface MatterForm {
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string;
  service_line_id: string;
  project_id: string;
  contract_id: string;
  counterparty_id: string;
  external_counsel_party_id: string;
  responsible_user_id: string;
  code: string;
  title: string;
  description: string;
  matter_type: string;
  jurisdiction: string;
  authority: string;
  case_number: string;
  status: string;
  risk_level: string;
  probability: string;
  exposure_currency_code: string;
  exposure_amount: string;
  opened_on: string;
  due_date: string;
  notes: string;
}

interface EventForm {
  event_type: string;
  title: string;
  description: string;
  occurred_at: string;
  due_at: string;
  status: string;
  responsible_user_id: string;
  evidence_reference: string;
  outcome: string;
}

const emptyMatter: MatterForm = {
  legal_entity_id: "",
  business_unit_id: "",
  product_id: "",
  service_line_id: "",
  project_id: "",
  contract_id: "",
  counterparty_id: "",
  external_counsel_party_id: "",
  responsible_user_id: "",
  code: "",
  title: "",
  description: "",
  matter_type: "analysis",
  jurisdiction: "BR",
  authority: "",
  case_number: "",
  status: "open",
  risk_level: "medium",
  probability: "0",
  exposure_currency_code: "BRL",
  exposure_amount: "0",
  opened_on: new Date().toISOString().slice(0, 10),
  due_date: "",
  notes: "",
};

const emptyEvent: EventForm = {
  event_type: "analysis",
  title: "",
  description: "",
  occurred_at: "",
  due_at: "",
  status: "planned",
  responsible_user_id: "",
  evidence_reference: "",
  outcome: "",
};

function nullable(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);
}

function localDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function LegalPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["legal-workspace"], queryFn: listLegalWorkspace });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [matterPage, setMatterPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [matterOpen, setMatterOpen] = useState(false);
  const [editingMatter, setEditingMatter] = useState<LegalMatter | null>(null);
  const [matterForm, setMatterForm] = useState<MatterForm>(emptyMatter);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventParentId, setEventParentId] = useState("");
  const [editingEvent, setEditingEvent] = useState<LegalMatterEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [closeMatter, setCloseMatter] = useState<LegalMatter | null>(null);
  const [closeOutcome, setCloseOutcome] = useState("");

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["legal-workspace"] });
      toast.success("Operação jurídica concluída.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha jurídica."),
  });

  const data = query.data;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!data) return { matters: [], events: [] };
    return {
      matters: data.legalMatters.filter((row) => {
        const matchesTerm = [
          row.code,
          row.title,
          row.description,
          row.case_number,
          row.authority,
          row.matter_type,
          row.risk_level,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
        return matchesTerm && (statusFilter === "all" || row.status === statusFilter);
      }),
      events: data.legalEvents.filter((row) =>
        [row.title, row.event_type, row.description, row.evidence_reference, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
    };
  }, [data, search, statusFilter]);

  if (query.error) {
    return <p className="p-6 text-sm text-destructive">{query.error.message}</p>;
  }
  if (query.isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando assuntos jurídicos...</p>;
  }

  const optionName = (items: { id: string; name: string }[], id: string | null) =>
    id ? (items.find((item) => item.id === id)?.name ?? id.slice(0, 8)) : "—";
  const matterName = (id: string) =>
    data.legalMatters.find((matter) => matter.id === id)?.title ?? id.slice(0, 8);
  const openMatters = data.legalMatters.filter(
    (matter) => !["closed", "cancelled"].includes(matter.status),
  );
  const overdue = openMatters.filter(
    (matter) => matter.due_date && matter.due_date < new Date().toISOString().slice(0, 10),
  );
  const totalExposure = openMatters.reduce(
    (total, matter) => total + Number(matter.exposure_amount),
    0,
  );
  const highRisk = openMatters.filter((matter) => ["high", "critical"].includes(matter.risk_level));

  const pagedMatters = filtered.matters.slice((matterPage - 1) * pageSize, matterPage * pageSize);
  const pagedEvents = filtered.events.slice((eventPage - 1) * pageSize, eventPage * pageSize);

  const openMatterEditor = (matter?: LegalMatter) => {
    setEditingMatter(matter ?? null);
    setMatterForm(
      matter
        ? {
            legal_entity_id: matter.legal_entity_id,
            business_unit_id: matter.business_unit_id ?? "",
            product_id: matter.product_id ?? "",
            service_line_id: matter.service_line_id ?? "",
            project_id: matter.project_id ?? "",
            contract_id: matter.contract_id ?? "",
            counterparty_id: matter.counterparty_id ?? "",
            external_counsel_party_id: matter.external_counsel_party_id ?? "",
            responsible_user_id: matter.responsible_user_id ?? "",
            code: matter.code,
            title: matter.title,
            description: matter.description ?? "",
            matter_type: matter.matter_type,
            jurisdiction: matter.jurisdiction ?? "",
            authority: matter.authority ?? "",
            case_number: matter.case_number ?? "",
            status: matter.status,
            risk_level: matter.risk_level,
            probability: String(matter.probability),
            exposure_currency_code: matter.exposure_currency_code,
            exposure_amount: String(matter.exposure_amount),
            opened_on: matter.opened_on,
            due_date: matter.due_date ?? "",
            notes: matter.notes ?? "",
          }
        : { ...emptyMatter, legal_entity_id: data.legalEntities[0]?.id ?? "" },
    );
    setMatterOpen(true);
  };

  const saveMatter = async () => {
    const values = {
      ...matterForm,
      business_unit_id: nullable(matterForm.business_unit_id),
      product_id: nullable(matterForm.product_id),
      service_line_id: nullable(matterForm.service_line_id),
      project_id: nullable(matterForm.project_id),
      contract_id: nullable(matterForm.contract_id),
      counterparty_id: nullable(matterForm.counterparty_id),
      external_counsel_party_id: nullable(matterForm.external_counsel_party_id),
      responsible_user_id: nullable(matterForm.responsible_user_id),
      description: nullable(matterForm.description),
      jurisdiction: nullable(matterForm.jurisdiction),
      authority: nullable(matterForm.authority),
      case_number: nullable(matterForm.case_number),
      probability: Number(matterForm.probability || 0),
      exposure_amount: Number(matterForm.exposure_amount || 0),
      due_date: nullable(matterForm.due_date),
      notes: nullable(matterForm.notes),
      storage_provider: "external",
    };
    await mutation.mutateAsync(() =>
      editingMatter
        ? updateLegalMatter(editingMatter.id, editingMatter.version, values)
        : createLegalMatter(values),
    );
    setMatterOpen(false);
  };

  const openEventEditor = (matterId: string, event?: LegalMatterEvent) => {
    setEventParentId(matterId);
    setEditingEvent(event ?? null);
    setEventForm(
      event
        ? {
            event_type: event.event_type,
            title: event.title,
            description: event.description ?? "",
            occurred_at: event.occurred_at?.slice(0, 16) ?? "",
            due_at: event.due_at?.slice(0, 16) ?? "",
            status: event.status,
            responsible_user_id: event.responsible_user_id ?? "",
            evidence_reference: event.evidence_reference ?? "",
            outcome: event.outcome ?? "",
          }
        : emptyEvent,
    );
    setEventOpen(true);
  };

  const saveEvent = async () => {
    const nextSequence =
      Math.max(
        0,
        ...data.legalEvents
          .filter((event) => event.legal_matter_id === eventParentId)
          .map((event) => event.sequence_no),
      ) + 1;
    const values = {
      legal_matter_id: eventParentId,
      sequence_no: editingEvent?.sequence_no ?? nextSequence,
      event_type: eventForm.event_type,
      title: eventForm.title,
      description: nullable(eventForm.description),
      occurred_at: nullable(eventForm.occurred_at),
      due_at: nullable(eventForm.due_at),
      status: eventForm.status,
      responsible_user_id: nullable(eventForm.responsible_user_id),
      evidence_reference: nullable(eventForm.evidence_reference),
      outcome: nullable(eventForm.outcome),
    };
    await mutation.mutateAsync(() =>
      editingEvent
        ? updateLegalEvent(editingEvent.id, editingEvent.version, values)
        : createLegalEvent(values),
    );
    setEventOpen(false);
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Jurídico"
        description="Acompanhe análises, notificações, disputas, processos, riscos, prazos, eventos, evidências e encerramentos jurídicos. Marcas e outros direitos permanecem cadastrados exclusivamente em Propriedade Intelectual."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Assuntos abertos" value={String(openMatters.length)} />
        <Kpi label="Prazos vencidos" value={String(overdue.length)} />
        <Kpi label="Risco alto ou crítico" value={String(highRisk.length)} />
        <Kpi label="Exposição aberta" value={money(totalExposure, "BRL")} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          className="max-w-md"
          placeholder="Buscar código, assunto, processo, autoridade ou risco"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setMatterPage(1);
            setEventPage(1);
          }}
        />
        <select
          className={`${fieldClass} md:w-56`}
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setMatterPage(1);
          }}
        >
          <option value="all">Todos os status</option>
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button className="md:ml-auto" onClick={() => openMatterEditor()}>
          <Plus className="h-4 w-4" /> Novo assunto
        </Button>
      </div>

      <section className="rounded-sm border">
        <SectionHeader
          title="Assuntos jurídicos"
          description="Fonte canônica de análises, disputas, processos e riscos."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <Th>Código / assunto</Th>
                <Th>Tipo</Th>
                <Th>Unidade</Th>
                <Th>Risco</Th>
                <Th>Exposição</Th>
                <Th>Prazo</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {pagedMatters.length === 0 && (
                <EmptyRow colSpan={8} label="Nenhum assunto jurídico encontrado." />
              )}
              {pagedMatters.map((matter) => (
                <tr key={matter.id} className="border-b last:border-0">
                  <Td>
                    <strong>{matter.code}</strong>
                    <div>{matter.title}</div>
                    <div className="max-w-xs truncate text-xs text-muted-foreground">
                      {matter.case_number || matter.authority || "Sem número externo"}
                    </div>
                  </Td>
                  <Td>
                    {matterTypes.find(([value]) => value === matter.matter_type)?.[1] ??
                      matter.matter_type}
                  </Td>
                  <Td>{optionName(data.businessUnits, matter.business_unit_id)}</Td>
                  <Td>
                    <StatusPill status={matter.risk_level} />
                  </Td>
                  <Td>{money(Number(matter.exposure_amount), matter.exposure_currency_code)}</Td>
                  <Td>{localDate(matter.due_date)}</Td>
                  <Td>
                    <StatusPill status={matter.status} />
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <IconButton label="Editar assunto" onClick={() => openMatterEditor(matter)}>
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Adicionar evento"
                        onClick={() => openEventEditor(matter.id)}
                      >
                        <FilePlus2 />
                      </IconButton>
                      {!["closed", "cancelled"].includes(matter.status) && (
                        <IconButton
                          label="Encerrar assunto"
                          onClick={() => {
                            setCloseMatter(matter);
                            setCloseOutcome("");
                          }}
                        >
                          <Scale />
                        </IconButton>
                      )}
                      {["draft", "closed", "cancelled"].includes(matter.status) && (
                        <IconButton
                          label="Excluir assunto"
                          destructive
                          onClick={() => {
                            if (window.confirm(`Excluir o assunto ${matter.code}?`)) {
                              mutation.mutate(() => deleteLegalMatter(matter.id));
                            }
                          }}
                        >
                          <Trash2 />
                        </IconButton>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={matterPage} total={filtered.matters.length} onChange={setMatterPage} />
      </section>

      <section className="rounded-sm border">
        <SectionHeader
          title="Eventos e prazos"
          description="Cronologia auditável de cada assunto jurídico."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <Th>Assunto</Th>
                <Th>Sequência</Th>
                <Th>Evento</Th>
                <Th>Ocorrência</Th>
                <Th>Prazo</Th>
                <Th>Responsável</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {pagedEvents.length === 0 && (
                <EmptyRow colSpan={8} label="Nenhum evento jurídico encontrado." />
              )}
              {pagedEvents.map((event) => (
                <tr key={event.id} className="border-b last:border-0">
                  <Td>{matterName(event.legal_matter_id)}</Td>
                  <Td>#{event.sequence_no}</Td>
                  <Td>
                    <strong>{event.title}</strong>
                    <div className="text-xs text-muted-foreground">{event.event_type}</div>
                  </Td>
                  <Td>{event.occurred_at ? localDate(event.occurred_at) : "—"}</Td>
                  <Td>{event.due_at ? localDate(event.due_at) : "—"}</Td>
                  <Td>{optionName(data.profiles, event.responsible_user_id)}</Td>
                  <Td>
                    <StatusPill status={event.status} />
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <IconButton
                        label="Editar evento"
                        onClick={() => openEventEditor(event.legal_matter_id, event)}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Excluir evento"
                        destructive
                        onClick={() => {
                          if (window.confirm(`Excluir o evento ${event.title}?`)) {
                            mutation.mutate(() => deleteLegalEvent(event.id));
                          }
                        }}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={eventPage} total={filtered.events.length} onChange={setEventPage} />
      </section>

      <Dialog open={matterOpen} onOpenChange={setMatterOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMatter ? "Editar assunto jurídico" : "Novo assunto jurídico"}
            </DialogTitle>
            <DialogDescription>
              Registre o assunto sem duplicar contratos, contrapartes ou ativos de propriedade
              intelectual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entidade jurídica">
              <Select
                value={matterForm.legal_entity_id}
                onChange={(value) => setMatterForm((form) => ({ ...form, legal_entity_id: value }))}
                options={data.legalEntities}
                required
              />
            </Field>
            <Field label="Unidade de negócio">
              <Select
                value={matterForm.business_unit_id}
                onChange={(value) =>
                  setMatterForm((form) => ({ ...form, business_unit_id: value }))
                }
                options={data.businessUnits}
                allowEmpty
              />
            </Field>
            <Field label="Código">
              <Input
                required
                value={matterForm.code}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))
                }
                placeholder="MAT-EXEMPLO-2026"
              />
            </Field>
            <Field label="Título">
              <Input
                required
                value={matterForm.title}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Tipo">
              <NativeSelect
                value={matterForm.matter_type}
                onChange={(value) => setMatterForm((form) => ({ ...form, matter_type: value }))}
                options={matterTypes}
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={matterForm.status}
                onChange={(value) => setMatterForm((form) => ({ ...form, status: value }))}
                options={statuses}
              />
            </Field>
            <Field label="Risco">
              <NativeSelect
                value={matterForm.risk_level}
                onChange={(value) => setMatterForm((form) => ({ ...form, risk_level: value }))}
                options={riskLevels}
              />
            </Field>
            <Field label="Probabilidade (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={matterForm.probability}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, probability: event.target.value }))
                }
              />
            </Field>
            <Field label="Moeda">
              <Select
                value={matterForm.exposure_currency_code}
                onChange={(value) =>
                  setMatterForm((form) => ({ ...form, exposure_currency_code: value }))
                }
                options={data.currencies}
                required
              />
            </Field>
            <Field label="Exposição financeira">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={matterForm.exposure_amount}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, exposure_amount: event.target.value }))
                }
              />
            </Field>
            <Field label="Data de abertura">
              <Input
                type="date"
                required
                value={matterForm.opened_on}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, opened_on: event.target.value }))
                }
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="date"
                value={matterForm.due_date}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, due_date: event.target.value }))
                }
              />
            </Field>
            <Field label="Contrato">
              <Select
                value={matterForm.contract_id}
                onChange={(value) => setMatterForm((form) => ({ ...form, contract_id: value }))}
                options={data.contracts}
                allowEmpty
              />
            </Field>
            <Field label="Contraparte">
              <Select
                value={matterForm.counterparty_id}
                onChange={(value) => setMatterForm((form) => ({ ...form, counterparty_id: value }))}
                options={data.parties}
                allowEmpty
              />
            </Field>
            <Field label="Responsável interno">
              <Select
                value={matterForm.responsible_user_id}
                onChange={(value) =>
                  setMatterForm((form) => ({ ...form, responsible_user_id: value }))
                }
                options={data.profiles}
                allowEmpty
              />
            </Field>
            <Field label="Advogado externo">
              <Select
                value={matterForm.external_counsel_party_id}
                onChange={(value) =>
                  setMatterForm((form) => ({ ...form, external_counsel_party_id: value }))
                }
                options={data.parties}
                allowEmpty
              />
            </Field>
            <Field label="Jurisdição">
              <Input
                value={matterForm.jurisdiction}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, jurisdiction: event.target.value }))
                }
              />
            </Field>
            <Field label="Autoridade">
              <Input
                value={matterForm.authority}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, authority: event.target.value }))
                }
              />
            </Field>
            <Field label="Número externo">
              <Input
                value={matterForm.case_number}
                onChange={(event) =>
                  setMatterForm((form) => ({ ...form, case_number: event.target.value }))
                }
              />
            </Field>
            <Field label="Projeto">
              <Select
                value={matterForm.project_id}
                onChange={(value) => setMatterForm((form) => ({ ...form, project_id: value }))}
                options={data.projects}
                allowEmpty
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={matterForm.description}
                  onChange={(event) =>
                    setMatterForm((form) => ({ ...form, description: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notas">
                <Textarea
                  value={matterForm.notes}
                  onChange={(event) =>
                    setMatterForm((form) => ({ ...form, notes: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatterOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !matterForm.legal_entity_id ||
                !matterForm.code ||
                !matterForm.title
              }
              onClick={saveMatter}
            >
              Salvar assunto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Editar evento jurídico" : "Novo evento jurídico"}
            </DialogTitle>
            <DialogDescription>
              Registre prazo, ocorrência, evidência e resultado na cronologia do assunto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo do evento">
              <Input
                value={eventForm.event_type}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, event_type: event.target.value }))
                }
              />
            </Field>
            <Field label="Título">
              <Input
                required
                value={eventForm.title}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Ocorrido em">
              <Input
                type="datetime-local"
                value={eventForm.occurred_at}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, occurred_at: event.target.value }))
                }
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="datetime-local"
                value={eventForm.due_at}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, due_at: event.target.value }))
                }
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={eventForm.status}
                onChange={(value) => setEventForm((form) => ({ ...form, status: value }))}
                options={[
                  ["planned", "Planejado"],
                  ["in_progress", "Em andamento"],
                  ["completed", "Concluído"],
                  ["cancelled", "Cancelado"],
                ]}
              />
            </Field>
            <Field label="Responsável">
              <Select
                value={eventForm.responsible_user_id}
                onChange={(value) =>
                  setEventForm((form) => ({ ...form, responsible_user_id: value }))
                }
                options={data.profiles}
                allowEmpty
              />
            </Field>
            <Field label="Referência da evidência">
              <Input
                value={eventForm.evidence_reference}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, evidence_reference: event.target.value }))
                }
              />
            </Field>
            <Field label="Resultado">
              <Input
                value={eventForm.outcome}
                onChange={(event) =>
                  setEventForm((form) => ({ ...form, outcome: event.target.value }))
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={eventForm.description}
                  onChange={(event) =>
                    setEventForm((form) => ({ ...form, description: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={mutation.isPending || !eventForm.title} onClick={saveEvent}>
              Salvar evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(closeMatter)} onOpenChange={(open) => !open && setCloseMatter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar assunto jurídico</DialogTitle>
            <DialogDescription>
              O encerramento exige permissão específica, MFA e um resultado auditável.
            </DialogDescription>
          </DialogHeader>
          <Field label="Resultado do encerramento">
            <Textarea
              value={closeOutcome}
              onChange={(event) => setCloseOutcome(event.target.value)}
              placeholder="Descreva acordo, decisão, conclusão ou providência final."
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseMatter(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending || closeOutcome.trim().length < 3}
              onClick={async () => {
                if (!closeMatter) return;
                await mutation.mutateAsync(() =>
                  closeLegalMatter(closeMatter.id, closeMatter.version, closeOutcome),
                );
                setCloseMatter(null);
              }}
            >
              Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Select({
  value,
  onChange,
  options,
  allowEmpty,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  allowEmpty?: boolean;
  required?: boolean;
}) {
  return (
    <select
      className={fieldClass}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty && <option value="">Não vinculado</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
function IconButton({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      className={destructive ? "text-destructive" : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t p-3 text-sm">
      <span>{total} registro(s)</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <span>
          Página {page} de {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
