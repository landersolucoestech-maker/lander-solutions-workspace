import type { AgendaEventStatus, AgendaEventType } from "./types";

export const EVENT_TYPE_OPTIONS: Array<{ value: AgendaEventType; label: string }> = [
  { value: "meeting", label: "Reunião" },
  { value: "appointment", label: "Compromisso" },
  { value: "deadline", label: "Prazo" },
  { value: "task", label: "Tarefa" },
  { value: "reminder", label: "Lembrete" },
  { value: "other", label: "Outro" },
];

export const STATUS_OPTIONS: Array<{ value: AgendaEventStatus; label: string }> = [
  { value: "scheduled", label: "Agendado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];
