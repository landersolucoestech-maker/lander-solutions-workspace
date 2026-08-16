import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { Panel, StatusPill } from "@/shared/components/ui-kit";
import { invokeSupportAction } from "../../api";
import type {
  SupportActionRequest,
  SupportEscalationEvent,
  SupportFormFieldInput,
  SupportFormFieldType,
  SupportNotificationChannel,
  SupportTicketStatus,
} from "../../contracts";
import type {
  SupportBusinessHours,
  SupportForm,
  SupportSlaPolicy,
  SupportTemplate,
  SupportWorkspace,
} from "../../types";
import { NONE_VALUE, supportErrorMessage as errorMessage } from "../editor-helpers";
import type { SupportEditorProps } from "../editor-types";

const weekdays = [
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
  [7, "Domingo"],
] as const;

export function BusinessHoursEditor({
  workspace,
  record,
  open,
  onOpenChange,
}: SupportEditorProps<SupportBusinessHours>) {
  const queryClient = useQueryClient();
  const currentIntervals = record
    ? workspace.businessHourIntervals.filter((item) => item.business_hours_id === record.id)
    : [];
  const currentHolidays = record
    ? workspace.holidays.filter((item) => item.business_hours_id === record.id)
    : [];
  const [form, setForm] = useState({
    name: record?.name ?? "",
    timezone: record?.timezone ?? workspace.settings.timezone,
    is24Hours: record?.is_24_hours ?? false,
    status: record?.status ?? "active",
  });
  const [intervals, setIntervals] = useState(
    currentIntervals.map((item) => ({
      localId: item.id,
      weekday: item.weekday,
      startsAt: item.starts_at,
      endsAt: item.ends_at,
    })),
  );
  const [holidays, setHolidays] = useState(
    currentHolidays.map((item) => ({
      localId: item.id,
      date: item.holiday_date,
      name: item.name,
      isClosed: item.is_closed,
      startsAt: item.special_starts_at ?? "",
      endsAt: item.special_ends_at ?? "",
    })),
  );
  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-business-hours",
        id: record?.id,
        expectedVersion: record?.version,
        productId: workspace.product.id,
        name: form.name.trim(),
        timezone: form.timezone.trim(),
        is24Hours: form.is24Hours,
        status: form.status as "active" | "inactive" | "archived",
        intervals: form.is24Hours
          ? []
          : intervals.map((item) => ({
              weekday: item.weekday,
              startsAt: item.startsAt,
              endsAt: item.endsAt,
            })),
        holidays: holidays.map((item) => ({
          date: item.date,
          name: item.name,
          isClosed: item.isClosed,
          startsAt: item.isClosed ? undefined : item.startsAt,
          endsAt: item.isClosed ? undefined : item.endsAt,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Horário atualizado." : "Horário criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar horário" : "Criar horário"}</DialogTitle>
          <DialogDescription>
            O cálculo é realizado no backend usando o timezone configurado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours-name">Nome</Label>
              <Input
                id="hours-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours-timezone">Timezone</Label>
              <Input
                id="hours-timezone"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, timezone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-sm border p-3">
              <div>
                <p className="font-medium">Operação 24 horas</p>
                <p className="text-xs text-muted-foreground">Ignora intervalos semanais.</p>
              </div>
              <Switch
                checked={form.is24Hours}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is24Hours: checked }))
                }
              />
            </div>
          </div>
          {!form.is24Hours ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Intervalos semanais</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setIntervals((current) => [
                      ...current,
                      {
                        localId: crypto.randomUUID(),
                        weekday: 1,
                        startsAt: "09:00",
                        endsAt: "18:00",
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Intervalo
                </Button>
              </div>
              {intervals.map((item) => (
                <div
                  key={item.localId}
                  className="grid gap-3 rounded-sm border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <Select
                    value={String(item.weekday)}
                    onValueChange={(value) =>
                      setIntervals((current) =>
                        current.map((currentItem) =>
                          currentItem.localId === item.localId
                            ? { ...currentItem, weekday: Number(value) }
                            : currentItem,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekdays.map(([value, label]) => (
                        <SelectItem key={value} value={String(value)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={item.startsAt}
                    onChange={(event) =>
                      setIntervals((current) =>
                        current.map((currentItem) =>
                          currentItem.localId === item.localId
                            ? { ...currentItem, startsAt: event.target.value }
                            : currentItem,
                        ),
                      )
                    }
                  />
                  <Input
                    type="time"
                    value={item.endsAt}
                    onChange={(event) =>
                      setIntervals((current) =>
                        current.map((currentItem) =>
                          currentItem.localId === item.localId
                            ? { ...currentItem, endsAt: event.target.value }
                            : currentItem,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setIntervals((current) =>
                        current.filter((currentItem) => currentItem.localId !== item.localId),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Feriados e exceções</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setHolidays((current) => [
                    ...current,
                    {
                      localId: crypto.randomUUID(),
                      date: "",
                      name: "",
                      isClosed: true,
                      startsAt: "09:00",
                      endsAt: "18:00",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Exceção
              </Button>
            </div>
            {holidays.map((item) => (
              <div key={item.localId} className="grid gap-3 rounded-sm border p-3 md:grid-cols-12">
                <Input
                  className="md:col-span-3"
                  type="date"
                  value={item.date}
                  onChange={(event) =>
                    setHolidays((current) =>
                      current.map((currentItem) =>
                        currentItem.localId === item.localId
                          ? { ...currentItem, date: event.target.value }
                          : currentItem,
                      ),
                    )
                  }
                />
                <Input
                  className="md:col-span-4"
                  value={item.name}
                  placeholder="Nome da data"
                  onChange={(event) =>
                    setHolidays((current) =>
                      current.map((currentItem) =>
                        currentItem.localId === item.localId
                          ? { ...currentItem, name: event.target.value }
                          : currentItem,
                      ),
                    )
                  }
                />
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <Checkbox
                    checked={item.isClosed}
                    onCheckedChange={(checked) =>
                      setHolidays((current) =>
                        current.map((currentItem) =>
                          currentItem.localId === item.localId
                            ? { ...currentItem, isClosed: checked === true }
                            : currentItem,
                        ),
                      )
                    }
                  />{" "}
                  Fechado
                </label>
                {!item.isClosed ? (
                  <>
                    <Input
                      className="md:col-span-1"
                      type="time"
                      value={item.startsAt}
                      onChange={(event) =>
                        setHolidays((current) =>
                          current.map((currentItem) =>
                            currentItem.localId === item.localId
                              ? { ...currentItem, startsAt: event.target.value }
                              : currentItem,
                          ),
                        )
                      }
                    />
                    <Input
                      className="md:col-span-1"
                      type="time"
                      value={item.endsAt}
                      onChange={(event) =>
                        setHolidays((current) =>
                          current.map((currentItem) =>
                            currentItem.localId === item.localId
                              ? { ...currentItem, endsAt: event.target.value }
                              : currentItem,
                          ),
                        )
                      }
                    />
                  </>
                ) : (
                  <div className="md:col-span-2" />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setHolidays((current) =>
                      current.filter((currentItem) => currentItem.localId !== item.localId),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !form.name.trim() || !form.timezone.trim()}
            >
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar horário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
