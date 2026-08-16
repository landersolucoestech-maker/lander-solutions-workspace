import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AgendaDirectory,
  AgendaEventWithAttendees,
  AgendaEventStatus,
  CreateAgendaEventInput,
  UpdateAgendaEventInput,
} from "./types";

export async function listAgendaEvents(from: Date, to: Date): Promise<AgendaEventWithAttendees[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("agenda_events")
    .select("*,agenda_event_attendees(*)")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as AgendaEventWithAttendees[];
}

export async function listAgendaDirectory(): Promise<AgendaDirectory> {
  const client = getSupabaseBrowserClient();
  const [businessUnits, parties, contracts, profiles] = await Promise.all([
    client.from("business_units").select("id,name").eq("status", "active").order("name"),
    client
      .from("parties")
      .select("id,legal_name,trade_name")
      .eq("status", "active")
      .order("legal_name"),
    client
      .from("contracts")
      .select("id,code,title")
      .in("status", ["active", "renewal"])
      .order("code"),
    client
      .from("profiles")
      .select("id,display_name,email")
      .eq("status", "active")
      .order("display_name"),
  ]);
  for (const result of [businessUnits, parties, contracts, profiles]) {
    if (result.error) throw result.error;
  }
  return {
    businessUnits: (businessUnits.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    parties: (parties.data ?? []).map((row) => ({
      id: row.id,
      name: row.trade_name || row.legal_name,
    })),
    contracts: (contracts.data ?? []).map((row) => ({
      id: row.id,
      name: `${row.code} — ${row.title}`,
    })),
    profiles: (profiles.data ?? []).map((row) => ({
      id: row.id,
      name: row.display_name || row.email || row.id,
    })),
  };
}

export async function createAgendaEvent(
  input: CreateAgendaEventInput,
): Promise<AgendaEventWithAttendees> {
  const client = getSupabaseBrowserClient();
  const businessUnitId = input.businessUnitId || null;
  const { data, error } = await client
    .from("agenda_events")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_type: input.eventType,
      status: input.status,
      starts_at: new Date(input.startsAt).toISOString(),
      ends_at: new Date(input.endsAt).toISOString(),
      all_day: input.allDay,
      location: input.location?.trim() || null,
      meeting_url: input.meetingUrl?.trim() || null,
      visibility: input.visibility,
      organizer_user_id: input.organizerUserId,
      business_unit_id: businessUnitId,
      party_id: input.partyId || null,
      contract_id: input.contractId || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const attendeeIds = [...new Set(input.attendeeProfileIds ?? [])].filter(
    (id) => id !== input.organizerUserId,
  );
  if (attendeeIds.length > 0) {
    const attendee = await client.from("agenda_event_attendees").insert(
      attendeeIds.map((profileId) => ({
        event_id: data.id,
        profile_id: profileId,
        attendee_role: "required",
      })),
    );
    if (attendee.error) {
      await client.from("agenda_events").delete().eq("id", data.id);
      throw attendee.error;
    }
  }
  const attendeeEmails = [...new Set(input.attendeeEmails ?? [])]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (attendeeEmails.length > 0) {
    const guests = await client.from("agenda_event_attendees").insert(
      attendeeEmails.map((email) => ({
        event_id: data.id,
        attendee_email: email,
        attendee_name: email,
        attendee_role: "required",
      })),
    );
    if (guests.error) {
      await client.from("agenda_events").delete().eq("id", data.id);
      throw guests.error;
    }
  }
  const created = await client
    .from("agenda_events")
    .select("*,agenda_event_attendees(*)")
    .eq("id", data.id)
    .single();
  if (created.error) throw created.error;
  return created.data as AgendaEventWithAttendees;
}

export async function updateAgendaEvent(input: UpdateAgendaEventInput) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("agenda_events")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_type: input.eventType,
      starts_at: new Date(input.startsAt).toISOString(),
      ends_at: new Date(input.endsAt).toISOString(),
      all_day: input.allDay,
      location: input.location?.trim() || null,
      meeting_url: input.meetingUrl?.trim() || null,
      visibility: input.visibility,
      organizer_user_id: input.organizerUserId,
      business_unit_id: input.businessUnitId || null,
      party_id: input.partyId || null,
      contract_id: input.contractId || null,
      status: input.status,
    })
    .eq("id", input.id)
    .eq("version", input.version)
    .select("*")
    .single();
  if (error) throw error;

  const deleted = await client.from("agenda_event_attendees").delete().eq("event_id", input.id);
  if (deleted.error) throw deleted.error;
  const attendeeIds = [...new Set(input.attendeeProfileIds ?? [])].filter(
    (id) => id !== data.organizer_user_id,
  );
  if (attendeeIds.length > 0) {
    const inserted = await client
      .from("agenda_event_attendees")
      .insert(attendeeIds.map((profileId) => ({ event_id: input.id, profile_id: profileId })));
    if (inserted.error) throw inserted.error;
  }
  const attendeeEmails = [...new Set(input.attendeeEmails ?? [])]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (attendeeEmails.length > 0) {
    const inserted = await client.from("agenda_event_attendees").insert(
      attendeeEmails.map((email) => ({
        event_id: input.id,
        attendee_email: email,
        attendee_name: email,
        attendee_role: "required",
      })),
    );
    if (inserted.error) throw inserted.error;
  }
  const updated = await client
    .from("agenda_events")
    .select("*,agenda_event_attendees(*)")
    .eq("id", input.id)
    .single();
  if (updated.error) throw updated.error;
  return updated.data as AgendaEventWithAttendees;
}

export async function deleteAgendaEvent(eventId: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.from("agenda_events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function updateAgendaEventStatus(
  eventId: string,
  status: AgendaEventStatus,
  version: number,
): Promise<AgendaEventWithAttendees> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("agenda_events")
    .update({ status })
    .eq("id", eventId)
    .eq("version", version)
    .select("*,agenda_event_attendees(*)")
    .single();
  if (error) throw error;
  return data as AgendaEventWithAttendees;
}
