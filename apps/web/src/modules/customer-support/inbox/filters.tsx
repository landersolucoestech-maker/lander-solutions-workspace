import { useState } from "react";
import { FilterX, Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
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
import type { SupportConversationStatus, SupportPriority, SupportWorkspace } from "../types";

const ANY_VALUE = "__any__";

export interface SupportInboxFilterState {
  search: string;
  queueId: string;
  agentUserId: string;
  channelId: string;
  categoryId: string;
  slaPolicyId: string;
  status: SupportConversationStatus | "";
  priority: SupportPriority | "";
  slaState: "within_sla" | "at_risk" | "breached" | "no_sla" | "";
  unassigned: boolean;
  dateFrom: string;
  dateTo: string;
}

export const emptySupportInboxFilters: SupportInboxFilterState = {
  search: "",
  queueId: "",
  agentUserId: "",
  channelId: "",
  categoryId: "",
  slaPolicyId: "",
  status: "",
  priority: "",
  slaState: "",
  unassigned: false,
  dateFrom: "",
  dateTo: "",
};

interface Props {
  workspace: SupportWorkspace;
  value: SupportInboxFilterState;
  onApply: (filters: SupportInboxFilterState) => void;
}

export function SupportInboxFilters({ workspace, value, onApply }: Props) {
  const [draft, setDraft] = useState(value);
  const activeMembers = workspace.productMembers.filter((member) => member.status === "active");

  const setOptional = (field: keyof SupportInboxFilterState, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value === ANY_VALUE ? "" : value,
    }));
  };

  return (
    <form
      className="grid gap-3 rounded-sm border bg-card p-4 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="support-inbox-search">Buscar</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="support-inbox-search"
            className="pl-9"
            value={draft.search}
            onChange={(event) =>
              setDraft((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Assunto, mensagem ou contato"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fila</Label>
        <Select
          value={draft.queueId || ANY_VALUE}
          onValueChange={(selected) => setOptional("queueId", selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as filas</SelectItem>
            {workspace.queues.map((queue) => (
              <SelectItem key={queue.id} value={queue.id}>
                {queue.name}
                {queue.status !== "active" ? " — inativa" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Agente</Label>
        <Select
          value={draft.agentUserId || ANY_VALUE}
          onValueChange={(selected) => setOptional("agentUserId", selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todos os agentes</SelectItem>
            {activeMembers.map((member) => {
              const profile = workspace.profiles.find((item) => item.id === member.user_id);
              return profile ? (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.displayName}
                </SelectItem>
              ) : null;
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Canal</Label>
        <Select
          value={draft.channelId || ANY_VALUE}
          onValueChange={(selected) => setOptional("channelId", selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todos os canais</SelectItem>
            {workspace.channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          value={draft.categoryId || ANY_VALUE}
          onValueChange={(selected) => setOptional("categoryId", selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as categorias</SelectItem>
            {workspace.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={draft.status || ANY_VALUE}
          onValueChange={(selected) =>
            setDraft((current) => ({
              ...current,
              status: selected === ANY_VALUE ? "" : (selected as SupportConversationStatus),
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todos os status</SelectItem>
            {[
              "new",
              "automation",
              "waiting_for_customer",
              "waiting_for_agent",
              "open",
              "pending",
              "resolved",
              "closed",
            ].map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Prioridade</Label>
        <Select
          value={draft.priority || ANY_VALUE}
          onValueChange={(selected) =>
            setDraft((current) => ({
              ...current,
              priority: selected === ANY_VALUE ? "" : (selected as SupportPriority),
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as prioridades</SelectItem>
            {["low", "normal", "high", "urgent", "critical"].map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Política de SLA</Label>
        <Select
          value={draft.slaPolicyId || ANY_VALUE}
          onValueChange={(selected) => setOptional("slaPolicyId", selected)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Todas as políticas</SelectItem>
            {workspace.slaPolicies.map((policy) => (
              <SelectItem key={policy.id} value={policy.id}>
                {policy.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Estado do SLA</Label>
        <Select
          value={draft.slaState || ANY_VALUE}
          onValueChange={(selected) =>
            setDraft((current) => ({
              ...current,
              slaState:
                selected === ANY_VALUE ? "" : (selected as SupportInboxFilterState["slaState"]),
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Qualquer estado</SelectItem>
            <SelectItem value="within_sla">Dentro do SLA</SelectItem>
            <SelectItem value="at_risk">Em risco</SelectItem>
            <SelectItem value="breached">Violado</SelectItem>
            <SelectItem value="no_sla">Sem SLA</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-date-from">Atividade a partir de</Label>
        <Input
          id="support-date-from"
          type="datetime-local"
          value={draft.dateFrom}
          onChange={(event) =>
            setDraft((current) => ({ ...current, dateFrom: event.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-date-to">Atividade até</Label>
        <Input
          id="support-date-to"
          type="datetime-local"
          value={draft.dateTo}
          onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-sm border p-3">
        <div>
          <p className="text-sm font-medium">Somente não atribuídos</p>
          <p className="text-xs text-muted-foreground">Sem agente atual.</p>
        </div>
        <Switch
          checked={draft.unassigned}
          onCheckedChange={(checked) =>
            setDraft((current) => ({ ...current, unassigned: checked }))
          }
        />
      </div>
      <div className="flex items-end justify-end gap-2 xl:col-span-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(emptySupportInboxFilters);
            onApply(emptySupportInboxFilters);
          }}
        >
          <FilterX className="h-4 w-4" /> Limpar
        </Button>
        <Button type="submit">Aplicar filtros</Button>
      </div>
    </form>
  );
}
