export type AgendaEventType =
  "meeting" | "appointment" | "deadline" | "task" | "reminder" | "other";

export type AgendaEventStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
export type AgendaVisibility = "private" | "unit" | "corporate";

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: AgendaEventType;
  starts_at: string;
  ends_at: string;
  timezone: string;
  all_day: boolean;
  location: string | null;
  meeting_url: string | null;
  status: AgendaEventStatus;
  visibility: AgendaVisibility;
  organizer_user_id: string;
  legal_entity_id: string | null;
  business_unit_id: string | null;
  party_id: string | null;
  contract_id: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgendaAttendee {
  id: string;
  event_id: string;
  profile_id: string | null;
  party_id: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_role: "required" | "optional";
  response_status: "pending" | "accepted" | "declined" | "tentative";
}

export interface AgendaEventWithAttendees extends AgendaEvent {
  agenda_event_attendees: AgendaAttendee[];
}

export interface AgendaReference {
  id: string;
  name: string;
}

export interface AgendaDirectory {
  businessUnits: AgendaReference[];
  parties: AgendaReference[];
  contracts: AgendaReference[];
  profiles: AgendaReference[];
}

export interface CreateAgendaEventInput {
  title: string;
  description?: string;
  eventType: AgendaEventType;
  status: AgendaEventStatus;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string;
  meetingUrl?: string;
  visibility: AgendaVisibility;
  organizerUserId: string;
  businessUnitId?: string;
  partyId?: string;
  contractId?: string;
  attendeeProfileIds?: string[];
  attendeeEmails?: string[];
}

export interface UpdateAgendaEventInput extends CreateAgendaEventInput {
  id: string;
  version: number;
}
