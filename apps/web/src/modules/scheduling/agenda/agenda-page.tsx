import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LockKeyhole, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { hasPermission } from "@/modules/access-control/api";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { AgendaCalendar, type AgendaView } from "./agenda-calendar";
import { AgendaEventFormDialog } from "./agenda-event-form-dialog";
import { AgendaEventViewDialog } from "./agenda-event-view-dialog";
import {
  deleteAgendaEvent,
  listAgendaDirectory,
  listAgendaEvents,
  updateAgendaEventStatus,
} from "./api";
import type { AgendaEventStatus, AgendaEventWithAttendees } from "./types";

interface FormState {
  initialDate: Date;
  event?: AgendaEventWithAttendees;
}

export function AgendaPage() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AgendaView>("month");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formState, setFormState] = useState<FormState | null>(null);
  const [viewingEvent, setViewingEvent] = useState<AgendaEventWithAttendees | null>(null);
  const authenticated = Boolean(session && user);
  const rangeStart = startOfYear(referenceDate);
  const rangeEnd = endOfYear(referenceDate);

  const readPermission = useQuery({
    queryKey: ["permission", "agenda.read"],
    queryFn: () => hasPermission("agenda.read"),
    enabled: authenticated,
  });
  const managePermission = useQuery({
    queryKey: ["permission", "agenda.manage"],
    queryFn: () => hasPermission("agenda.manage"),
    enabled: authenticated,
  });
  const canRead = authenticated && readPermission.data === true;
  const canManage = authenticated && managePermission.data === true;

  useEffect(() => {
    const handleCreate = () => setFormState({ initialDate: referenceDate });
    window.addEventListener("agenda:create", handleCreate);
    return () => window.removeEventListener("agenda:create", handleCreate);
  }, [referenceDate]);

  const eventsQuery = useQuery({
    queryKey: ["agenda-events", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () => listAgendaEvents(rangeStart, new Date(rangeEnd.getTime() + 1)),
    enabled: authenticated && canRead,
  });
  const directoryQuery = useQuery({
    queryKey: ["agenda-directory"],
    queryFn: listAgendaDirectory,
    enabled: authenticated && canRead,
  });

  const filteredEvents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (eventsQuery.data ?? []).filter(
      (event) =>
        (statusFilter === "all" || event.status === statusFilter) &&
        (!normalized ||
          [event.title, event.description ?? "", event.location ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalized)),
    );
  }, [eventsQuery.data, search, statusFilter]);
  const periodEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        const startsAt = new Date(event.starts_at);
        if (view === "day") return isSameDay(startsAt, referenceDate);
        if (view === "week") return isSameWeek(startsAt, referenceDate, { weekStartsOn: 1 });
        return isSameMonth(startsAt, referenceDate);
      }),
    [filteredEvents, referenceDate, view],
  );

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      version,
    }: {
      id: string;
      status: AgendaEventStatus;
      version: number;
    }) => {
      if (!canManage)
        throw new Error("Uma sessão autorizada é necessária para alterar compromissos.");
      return updateAgendaEventStatus(id, status, version);
    },
    onSuccess: () => {
      setViewingEvent(null);
      queryClient.invalidateQueries({ queryKey: ["agenda-events"] });
      toast.success("Compromisso atualizado.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!canManage)
        throw new Error("Uma sessão autorizada é necessária para excluir compromissos.");
      await deleteAgendaEvent(eventId);
    },
    onSuccess: () => {
      setViewingEvent(null);
      queryClient.invalidateQueries({ queryKey: ["agenda-events"] });
      toast.success("Compromisso excluído.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir."),
  });

  if (authenticated && readPermission.isPending) {
    return <p className="p-4 text-sm text-muted-foreground">Validando acesso à agenda…</p>;
  }
  if (authenticated && !canRead) {
    return (
      <Alert className="m-3">
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription>A permissão agenda.read é necessária.</AlertDescription>
      </Alert>
    );
  }

  const navigate = (direction: -1 | 1) => {
    if (view === "day") setReferenceDate((current) => addDays(current, direction));
    else if (view === "week") setReferenceDate((current) => addWeeks(current, direction));
    else setReferenceDate((current) => addMonths(current, direction));
  };
  const openCreate = (date = referenceDate) => setFormState({ initialDate: date });

  return (
    <div className="min-w-0 p-2 md:p-3">
      <section
        className="overflow-hidden rounded-md border bg-card shadow-sm"
        data-testid="agenda-calendar-shell"
      >
        <div className="flex flex-col gap-3 border-b px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setReferenceDate(new Date())}>
              Hoje
            </Button>
            <div className="flex items-center rounded-md border">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-r-none"
                aria-label="Período anterior"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-l-none"
                aria-label="Próximo período"
                onClick={() => navigate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="min-w-0 text-base font-semibold capitalize sm:text-lg">
              {periodLabel(referenceDate, view)}
            </h1>
          </div>
          <div
            className="flex items-center gap-1 self-start rounded-md border p-1 lg:self-auto"
            aria-label="Visualização da agenda"
          >
            {(["month", "week", "day"] as AgendaView[]).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={view === option ? "default" : "ghost"}
                onClick={() => setView(option)}
              >
                {option === "month" ? "Mês" : option === "week" ? "Semana" : "Dia"}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b bg-muted/10 px-3 py-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(input) => setSearch(input.target.value)}
              placeholder="Buscar por título, descrição ou local"
              className="h-9 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!authenticated && (
          <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
            Os dados dos compromissos exigem uma sessão autorizada. O calendário permanece
            disponível para navegação.
          </div>
        )}
        {authenticated && eventsQuery.isError && (
          <Alert className="m-3">
            <AlertTitle>Falha ao carregar compromissos</AlertTitle>
            <AlertDescription>
              {eventsQuery.error instanceof Error ? eventsQuery.error.message : "Erro inesperado."}
            </AlertDescription>
          </Alert>
        )}
        {authenticated && eventsQuery.isPending && (
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">
            Carregando compromissos…
          </p>
        )}
        {authenticated &&
          !eventsQuery.isPending &&
          !eventsQuery.isError &&
          periodEvents.length === 0 && (
            <p className="border-b px-3 py-2 text-xs text-muted-foreground">
              Os compromissos serão exibidos quando houver dados disponíveis neste período.
            </p>
          )}

        <AgendaCalendar
          view={view}
          referenceDate={referenceDate}
          events={filteredEvents}
          onSelectEvent={setViewingEvent}
          onSelectDate={setReferenceDate}
          onCreateAt={openCreate}
        />
      </section>

      {formState && (
        <AgendaEventFormDialog
          key={`${formState.event?.id ?? "new"}-${formState.event?.version ?? formState.initialDate.toISOString()}`}
          open
          onOpenChange={(open) => !open && setFormState(null)}
          initialDate={formState.initialDate}
          event={formState.event}
          organizerId={user?.id}
          directory={directoryQuery.data}
          canPersist={canManage}
          onSaved={() => {
            setFormState(null);
            queryClient.invalidateQueries({ queryKey: ["agenda-events"] });
          }}
        />
      )}
      <AgendaEventViewDialog
        event={viewingEvent}
        directory={directoryQuery.data}
        canManage={canManage}
        onOpenChange={(open) => !open && setViewingEvent(null)}
        onEdit={() => {
          if (!viewingEvent) return;
          setFormState({ initialDate: new Date(viewingEvent.starts_at), event: viewingEvent });
          setViewingEvent(null);
        }}
        onCancel={() =>
          viewingEvent &&
          statusMutation.mutate({
            id: viewingEvent.id,
            status: "cancelled",
            version: viewingEvent.version,
          })
        }
        onDelete={() => viewingEvent && deleteMutation.mutate(viewingEvent.id)}
      />
    </div>
  );
}

function periodLabel(date: Date, view: AgendaView) {
  if (view === "day") return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  if (view === "week") {
    const start = addDays(date, -((date.getDay() + 6) % 7));
    const end = addDays(start, 6);
    return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
  }
  return format(date, "MMMM 'de' yyyy", { locale: ptBR });
}
