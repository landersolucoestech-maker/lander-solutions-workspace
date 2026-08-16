import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = read("src/modules/scheduling/agenda/agenda-page.tsx");
const calendar = read("src/modules/scheduling/agenda/agenda-calendar.tsx");
const form = read("src/modules/scheduling/agenda/agenda-event-form-dialog.tsx");
const view = read("src/modules/scheduling/agenda/agenda-event-view-dialog.tsx");
const topbar = read("src/app/navigation/topbar.tsx");

describe("Agenda ownership and experience", () => {
  it("uses only agenda permissions and keeps reads protected", () => {
    expect(page).toContain('hasPermission("agenda.read")');
    expect(page).toContain('hasPermission("agenda.manage")');
    expect(page).toContain("enabled: authenticated && canRead");
    expect(page).not.toContain("contracts.documents.manage");
  });

  it("owns events and attendees while consuming canonical references", () => {
    const api = read("src/modules/scheduling/agenda/api.ts");
    expect(api).toContain('from("agenda_events")');
    expect(api).toContain('from("agenda_event_attendees")');
    for (const master of ["business_units", "parties", "contracts", "profiles"]) {
      expect(api).toContain(`from("${master}")`);
    }
  });

  it("renders the full calendar with auth off and no fake data", () => {
    expect(page).toContain('data-testid="agenda-calendar-shell"');
    expect(page).toContain("Os dados dos compromissos exigem uma sessão autorizada");
    expect(page).toContain("<AgendaCalendar");
    expect(topbar).toContain("Novo compromisso");
    expect(page).not.toContain("Agenda pronta para uso autenticado");
    expect(page).not.toMatch(/mockEvents|fakeEvents|seedEvent/);
  });

  it("supports today, previous/next and month, week and day views", () => {
    expect(page).toMatch(/>\s*Hoje\s*<\/Button>/);
    expect(page).toContain('aria-label="Período anterior"');
    expect(page).toContain('aria-label="Próximo período"');
    expect(page).toContain('["month", "week", "day"]');
    expect(calendar).toContain('data-testid="agenda-month-view"');
    expect(calendar).toContain('data-testid="agenda-week-view"');
    expect(calendar).toContain('data-testid="agenda-day-view"');
  });

  it("keeps the route-specific create action and removes global unit/date controls", () => {
    const agendaAction = topbar.indexOf("{isAgenda && (");
    const unitRule = topbar.slice(
      topbar.indexOf("const showUnitSelector"),
      topbar.indexOf("const showPeriodSelector"),
    );
    const periodRule = topbar.slice(
      topbar.indexOf("const showPeriodSelector"),
      topbar.indexOf("const optionsQuery"),
    );
    expect(topbar).toContain('dispatchPageEvent("agenda:create")');
    expect(agendaAction).toBeGreaterThan(-1);
    expect(unitRule).toContain("!isAgenda");
    expect(periodRule).toContain("!isAgenda");
    expect(page).toContain('window.addEventListener("agenda:create", handleCreate)');
    expect(page).not.toMatch(/<Button size="sm" onClick=\{\(\) => openCreate\(\)\}>/);
  });

  it("opens events in a dedicated view before editing", () => {
    expect(page).toContain("onSelectEvent={setViewingEvent}");
    expect(page).toContain("<AgendaEventViewDialog");
    expect(view).toContain("Visualizar compromisso");
    expect(view).toMatch(/>\s*<Pencil[^>]*\/>\s*Editar\s*<\/Button>/);
    expect(view).not.toContain("disabled input");
  });

  it("reuses one hydrated form for create and edit with real domain fields", () => {
    expect(page.match(/<AgendaEventFormDialog/g)).toHaveLength(1);
    for (const label of [
      "Título",
      "Tipo de compromisso",
      "Status",
      "Data inicial",
      "Data final",
      "Horário inicial",
      "Horário final",
      "Dia inteiro",
      "Descrição",
      "Local / reunião",
      "Responsável",
      "Unidade de negócio",
      "Participantes internos",
    ])
      expect(form).toContain(`label="${label}"`);
    expect(form).toContain('event?.title ?? ""');
    expect(form).toContain("event?.agenda_event_attendees");
    expect(form).toContain("return event");
    expect(form).toContain("? updateAgendaEvent");
    expect(form).toContain(": createAgendaEvent(values)");
    expect(form).toContain('<Field label="Local / reunião">');
    expect(form).toContain('<Field label="Link da reunião">');
    expect(page).not.toContain("Exportar");
    expect(page).not.toContain("exportAgenda");
  });

  it("never enables anonymous mutations or weakens agenda RLS", () => {
    const hardening = read(
      "../../supabase/migrations/20260812081749_harden_agenda_rls_privileges.sql",
    );
    expect(hardening).toContain("revoke all on table public.agenda_events from anon");
    expect(hardening).toContain("revoke all on table public.agenda_event_attendees from anon");
    expect(form).toMatch(/if \(!canPersist\)\s*throw new Error/);
    expect(page).toMatch(/if \(!canManage\)\s*throw new Error/);
  });

  it("keeps cancellation before deletion as the domain rule", () => {
    const deletionRule = read(
      "../../supabase/migrations/20260812125118_enforce_agenda_deletion_rule.sql",
    );
    expect(deletionRule).toContain("Only cancelled agenda events can be deleted");
    expect(view).toContain('event.status === "cancelled"');
    expect(view).toContain("Cancelar compromisso");
  });
});
