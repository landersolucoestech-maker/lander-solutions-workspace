import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock3, MapPin } from "lucide-react";

import { cn } from "@/shared/utils/cn";
import type { AgendaEventWithAttendees } from "./types";

export type AgendaView = "month" | "week" | "day";

interface AgendaCalendarProps {
  view: AgendaView;
  referenceDate: Date;
  events: AgendaEventWithAttendees[];
  onSelectEvent: (event: AgendaEventWithAttendees) => void;
  onSelectDate: (date: Date) => void;
  onCreateAt: (date: Date) => void;
}

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);

export function AgendaCalendar(props: AgendaCalendarProps) {
  if (props.view === "week") return <WeekCalendar {...props} />;
  if (props.view === "day") return <DayCalendar {...props} />;
  return <MonthCalendar {...props} />;
}

function MonthCalendar({
  referenceDate,
  events,
  onSelectEvent,
  onSelectDate,
  onCreateAt,
}: AgendaCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 0 }),
  });

  return (
    <div className="overflow-x-auto" data-testid="agenda-month-view">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(new Date(event.starts_at), day));
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "group min-h-28 border-b border-r p-1.5 transition-colors hover:bg-muted/20",
                  !isSameMonth(day, referenceDate) && "bg-muted/15 text-muted-foreground",
                )}
                onDoubleClick={() => onCreateAt(day)}
              >
                <button
                  type="button"
                  className={cn(
                    "mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                  onClick={() => onSelectDate(day)}
                  aria-label={`Selecionar ${format(day, "d 'de' MMMM", { locale: ptBR })}`}
                >
                  {format(day, "d")}
                </button>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventChip key={event.id} event={event} onClick={() => onSelectEvent(event)} />
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="px-1 text-[11px] font-medium text-muted-foreground">
                      +{dayEvents.length - 3} compromissos
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekCalendar(props: AgendaCalendarProps) {
  const weekStart = startOfWeek(props.referenceDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });

  return (
    <div className="overflow-x-auto" data-testid="agenda-week-view">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[64px_repeat(7,minmax(112px,1fr))] border-b bg-muted/30">
          <div />
          {days.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              className="border-l px-2 py-2 text-center hover:bg-muted/40"
              onClick={() => props.onSelectDate(day)}
            >
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </span>
              <span
                className={cn(
                  "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          ))}
        </div>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid min-h-16 grid-cols-[64px_repeat(7,minmax(112px,1fr))] border-b"
          >
            <div className="px-2 pt-1 text-right text-[10px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => {
              const slotEvents = props.events.filter((event) => {
                const start = new Date(event.starts_at);
                return (
                  isSameDay(start, day) && (event.all_day ? hour === 7 : start.getHours() === hour)
                );
              });
              return (
                <div
                  key={day.toISOString()}
                  className="border-l p-1 hover:bg-muted/15"
                  onDoubleClick={() => props.onCreateAt(withHour(day, hour))}
                >
                  {slotEvents.map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      onClick={() => props.onSelectEvent(event)}
                      detailed
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCalendar(props: AgendaCalendarProps) {
  const allDay = props.events.filter(
    (event) => event.all_day && isSameDay(new Date(event.starts_at), props.referenceDate),
  );

  return (
    <div data-testid="agenda-day-view">
      {allDay.length > 0 && (
        <div className="grid grid-cols-[64px_1fr] border-b bg-muted/20">
          <div className="px-2 py-2 text-right text-[10px] text-muted-foreground">DIA TODO</div>
          <div className="space-y-1 border-l p-2">
            {allDay.map((event) => (
              <EventChip
                key={event.id}
                event={event}
                onClick={() => props.onSelectEvent(event)}
                detailed
              />
            ))}
          </div>
        </div>
      )}
      {HOURS.map((hour) => {
        const slotEvents = props.events.filter((event) => {
          const start = new Date(event.starts_at);
          return (
            !event.all_day && isSameDay(start, props.referenceDate) && start.getHours() === hour
          );
        });
        return (
          <div key={hour} className="grid min-h-20 grid-cols-[64px_1fr] border-b">
            <div className="px-2 pt-1 text-right text-[10px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            <div
              className="space-y-1 border-l p-1.5 hover:bg-muted/15"
              onDoubleClick={() => props.onCreateAt(withHour(props.referenceDate, hour))}
            >
              {slotEvents.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  onClick={() => props.onSelectEvent(event)}
                  detailed
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventChip({
  event,
  onClick,
  detailed = false,
}: {
  event: AgendaEventWithAttendees;
  onClick: () => void;
  detailed?: boolean;
}) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  return (
    <button
      type="button"
      className={cn(
        "block w-full rounded border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-95",
        statusTone(event.status),
      )}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      title={event.title}
    >
      <span className="block truncate font-semibold">{event.title}</span>
      <span className="mt-0.5 flex items-center gap-1 opacity-80">
        <Clock3 className="h-2.5 w-2.5" />
        {event.all_day ? "Dia inteiro" : `${format(start, "HH:mm")}–${format(end, "HH:mm")}`}
      </span>
      {detailed && event.location && (
        <span className="mt-0.5 flex items-center gap-1 truncate opacity-80">
          <MapPin className="h-2.5 w-2.5" /> {event.location}
        </span>
      )}
    </button>
  );
}

function statusTone(status: AgendaEventWithAttendees["status"]) {
  if (status === "confirmed") return "border-emerald-600 bg-emerald-100 text-emerald-900";
  if (status === "completed") return "border-sky-600 bg-sky-100 text-sky-900";
  if (status === "cancelled") return "border-rose-500 bg-rose-100 text-rose-900 line-through";
  return "border-primary bg-primary/10 text-foreground";
}

function withHour(date: Date, hour: number) {
  const value = new Date(date);
  value.setHours(hour, 0, 0, 0);
  return value;
}
