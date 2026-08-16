import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { LockKeyhole } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { createAgendaEvent, updateAgendaEvent } from "./api";
import { EVENT_TYPE_OPTIONS, STATUS_OPTIONS } from "./agenda-options";
import type {
  AgendaDirectory,
  AgendaEventStatus,
  AgendaEventType,
  AgendaEventWithAttendees,
  AgendaVisibility,
} from "./types";

const NONE = "__none__";

interface AgendaEventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: Date;
  event?: AgendaEventWithAttendees;
  organizerId?: string;
  directory?: AgendaDirectory;
  canPersist: boolean;
  onSaved: () => void;
}

export function AgendaEventFormDialog({
  open,
  onOpenChange,
  initialDate,
  event,
  organizerId,
  directory,
  canPersist,
  onSaved,
}: AgendaEventFormDialogProps) {
  const defaultStart = new Date(initialDate);
  defaultStart.setMinutes(0, 0, 0);
  if (defaultStart.getHours() < 7 || defaultStart.getHours() > 20) defaultStart.setHours(9);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60_000);
  const eventStart = event ? new Date(event.starts_at) : defaultStart;
  const eventEnd = event ? new Date(event.ends_at) : defaultEnd;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventType, setEventType] = useState<AgendaEventType>(event?.event_type ?? "meeting");
  const [status, setStatus] = useState<AgendaEventStatus>(event?.status ?? "scheduled");
  const [startDate, setStartDate] = useState(format(eventStart, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(eventStart, "HH:mm"));
  const [endDate, setEndDate] = useState(format(eventEnd, "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState(format(eventEnd, "HH:mm"));
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [visibility, setVisibility] = useState<AgendaVisibility>(event?.visibility ?? "unit");
  const [responsibleId, setResponsibleId] = useState(event?.organizer_user_id ?? organizerId ?? "");
  const [businessUnitId, setBusinessUnitId] = useState(event?.business_unit_id ?? "");
  const [partyId, setPartyId] = useState(event?.party_id ?? "");
  const [contractId, setContractId] = useState(event?.contract_id ?? "");
  const [attendeeProfileIds, setAttendeeProfileIds] = useState<string[]>(
    event?.agenda_event_attendees.flatMap((attendee) =>
      attendee.profile_id ? [attendee.profile_id] : [],
    ) ?? [],
  );
  const [attendeeEmails, setAttendeeEmails] = useState(
    event?.agenda_event_attendees
      .flatMap((attendee) => (attendee.attendee_email ? [attendee.attendee_email] : []))
      .join(", ") ?? "",
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(event?.meeting_url ?? "");

  const startsAt = `${startDate}T${allDay ? "00:00" : startTime}`;
  const endsAt = `${endDate}T${allDay ? "23:59" : endTime}`;
  const valid =
    title.trim().length >= 3 &&
    new Date(endsAt) > new Date(startsAt) &&
    Boolean(responsibleId) &&
    (visibility !== "unit" || Boolean(businessUnitId));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canPersist)
        throw new Error("Uma sessão autorizada é necessária para salvar compromissos.");
      const values = {
        title,
        description,
        eventType,
        status,
        startsAt,
        endsAt,
        allDay,
        location,
        meetingUrl,
        visibility,
        organizerUserId: responsibleId,
        businessUnitId,
        partyId,
        contractId,
        attendeeProfileIds,
        attendeeEmails: attendeeEmails.split(/[;,\n]/),
      };
      return event
        ? updateAgendaEvent({ ...values, id: event.id, version: event.version })
        : createAgendaEvent(values);
    },
    onSuccess: () => {
      toast.success(event ? "Compromisso atualizado." : "Compromisso criado.");
      onSaved();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle>{event ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          <DialogDescription>
            {event
              ? "Atualize os dados preservando a identidade do compromisso."
              : "Registre um compromisso empresarial na agenda."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          {!canPersist && (
            <div className="mb-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Modo de visualização: salvar exige uma sessão autorizada. Nenhum acesso anônimo será
                utilizado.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input
                value={title}
                onChange={(input) => setTitle(input.target.value)}
                placeholder="Nome do compromisso"
              />
            </Field>
            <Field label="Tipo de compromisso">
              <Select
                value={eventType}
                onValueChange={(value) => setEventType(value as AgendaEventType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as AgendaEventStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data inicial">
              <Input
                type="date"
                value={startDate}
                onChange={(input) => setStartDate(input.target.value)}
              />
            </Field>
            <Field label="Data final">
              <Input
                type="date"
                value={endDate}
                onChange={(input) => setEndDate(input.target.value)}
              />
            </Field>
            {!allDay && (
              <>
                <Field label="Horário inicial">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(input) => setStartTime(input.target.value)}
                  />
                </Field>
                <Field label="Horário final">
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(input) => setEndTime(input.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label="Dia inteiro" className="sm:col-span-2">
              <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Switch
                  checked={allDay}
                  onCheckedChange={setAllDay}
                  aria-label="Compromisso de dia inteiro"
                />
                <span className="text-sm text-muted-foreground">
                  O compromisso ocupa o dia todo
                </span>
              </div>
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <Textarea
                value={description}
                onChange={(input) => setDescription(input.target.value)}
                rows={4}
                placeholder="Contexto, pauta ou observações"
              />
            </Field>
            <Field label="Local / reunião">
              <Input
                value={location}
                onChange={(input) => setLocation(input.target.value)}
                placeholder="Sala, endereço ou referência"
              />
            </Field>
            <Field label="Link da reunião">
              <Input
                type="url"
                value={meetingUrl}
                onChange={(input) => setMeetingUrl(input.target.value)}
                placeholder="https://"
              />
            </Field>
            <ReferenceSelect
              label="Responsável"
              value={responsibleId}
              setValue={setResponsibleId}
              items={directory?.profiles ?? []}
            />
            <ReferenceSelect
              label="Unidade de negócio"
              value={businessUnitId}
              setValue={setBusinessUnitId}
              items={directory?.businessUnits ?? []}
            />
            <Field label="Visibilidade">
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as AgendaVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Privada</SelectItem>
                  <SelectItem value="unit">Unidade</SelectItem>
                  <SelectItem value="corporate">Corporativa</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ReferenceSelect
              label="Parte relacionada"
              value={partyId}
              setValue={setPartyId}
              items={directory?.parties ?? []}
              optional
            />
            <ReferenceSelect
              label="Contrato relacionado"
              value={contractId}
              setValue={setContractId}
              items={directory?.contracts ?? []}
              optional
            />
            <Field label="Participantes internos" className="sm:col-span-2">
              <select
                multiple
                value={attendeeProfileIds}
                onChange={(input) =>
                  setAttendeeProfileIds(
                    [...input.currentTarget.selectedOptions].map((option) => option.value),
                  )
                }
                className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
              >
                {(directory?.profiles.filter((profile) => profile.id !== responsibleId) ?? []).map(
                  (profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ),
                )}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Use Ctrl/Cmd para selecionar mais de um participante.
              </p>
            </Field>
            <Field label="Convidados externos (e-mails)" className="sm:col-span-2">
              <Input
                value={attendeeEmails}
                onChange={(input) => setAttendeeEmails(input.target.value)}
                placeholder="contato@empresa.com, outro@empresa.com"
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={!canPersist || !valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Salvando…" : event ? "Salvar alterações" : "Criar compromisso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function ReferenceSelect({
  label,
  value,
  setValue,
  items,
  optional = false,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  items: Array<{ id: string; name: string }>;
  optional?: boolean;
}) {
  return (
    <Field label={label}>
      <Select
        value={value || (optional ? NONE : undefined)}
        onValueChange={(next) => setValue(next === NONE ? "" : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>Nenhum</SelectItem>}
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
