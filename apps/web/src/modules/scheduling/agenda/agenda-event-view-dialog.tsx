import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  Clock3,
  Link2,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

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
import { EVENT_TYPE_OPTIONS, STATUS_OPTIONS } from "./agenda-options";
import type { AgendaDirectory, AgendaEventWithAttendees } from "./types";

interface AgendaEventViewDialogProps {
  event: AgendaEventWithAttendees | null;
  directory?: AgendaDirectory;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function AgendaEventViewDialog({
  event,
  directory,
  canManage,
  onOpenChange,
  onEdit,
  onCancel,
  onDelete,
}: AgendaEventViewDialogProps) {
  if (!event) return null;
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const organizer = directory?.profiles.find((item) => item.id === event.organizer_user_id)?.name;
  const unit = directory?.businessUnits.find((item) => item.id === event.business_unit_id)?.name;
  const attendeeNames = event.agenda_event_attendees.map((attendee) =>
    attendee.profile_id
      ? (directory?.profiles.find((item) => item.id === attendee.profile_id)?.name ??
        "Participante interno")
      : attendee.attendee_name || attendee.attendee_email || "Participante",
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="break-words text-xl">{event.title}</DialogTitle>
              <DialogDescription className="mt-1">Visualizar compromisso</DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{labelFor(EVENT_TYPE_OPTIONS, event.event_type)}</Badge>
              <Badge>{labelFor(STATUS_OPTIONS, event.status)}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <Section title="Quando" icon={CalendarDays}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Data"
                value={
                  event.all_day
                    ? format(start, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : `${format(start, "d 'de' MMMM 'de' yyyy", { locale: ptBR })} — ${format(end, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                }
              />
              <Detail
                label="Horário"
                value={
                  event.all_day
                    ? "Dia inteiro"
                    : `${format(start, "HH:mm")}–${format(end, "HH:mm")}`
                }
                icon={Clock3}
              />
            </div>
          </Section>

          {(event.location || event.meeting_url) && (
            <Section title="Onde" icon={MapPin}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail label="Local / reunião" value={event.location} />
                <Detail label="Link da reunião" value={event.meeting_url} icon={Link2} />
              </div>
            </Section>
          )}

          <Section title="Organização" icon={Building2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Responsável" value={organizer} icon={UserRound} />
              <Detail label="Unidade de negócio" value={unit} />
              <Detail label="Visibilidade" value={visibilityLabel(event.visibility)} />
              <Detail label="Fuso horário" value={event.timezone} />
            </div>
          </Section>

          {attendeeNames.length > 0 && (
            <Section title="Participantes" icon={UsersRound}>
              <div className="flex flex-wrap gap-2">
                {attendeeNames.map((name, index) => (
                  <Badge key={`${name}-${index}`} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {event.description && (
            <Section title="Descrição" icon={CalendarDays}>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {event.description}
              </p>
            </Section>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canManage && event.status === "cancelled" && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          {canManage && event.status !== "cancelled" && event.status !== "completed" && (
            <Button variant="outline" onClick={onCancel}>
              <XCircle className="h-4 w-4" /> Cancelar compromisso
            </Button>
          )}
          {canManage && (
            <Button onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: typeof Clock3;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-start gap-1.5 break-words text-sm font-medium">
        {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        {value || "—"}
      </p>
    </div>
  );
}

function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function visibilityLabel(value: AgendaEventWithAttendees["visibility"]) {
  if (value === "private") return "Privada";
  if (value === "corporate") return "Corporativa";
  return "Unidade";
}
