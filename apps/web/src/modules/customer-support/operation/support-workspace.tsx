import { useMemo, useState } from "react";
import { Inbox, MessageSquareText, Search } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { StatusPill } from "@/shared/components/ui-kit";
import { SupportConversationPanel } from "../inbox/conversation-sheet";
import type { SupportConversation, SupportConversationStatus, SupportWorkspace } from "../types";

type InboxStatus = "all" | SupportConversationStatus;

const STATUS_FILTERS: Array<{ value: InboxStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "new", label: "Novas" },
  { value: "open", label: "Em atendimento" },
  { value: "waiting_for_customer", label: "Aguardando cliente" },
  { value: "waiting_for_agent", label: "Aguardando equipe" },
  { value: "pending", label: "Pendentes" },
  { value: "resolved", label: "Resolvidas" },
];

function formatActivity(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SupportOperationalWorkspace({
  workspace,
  conversations,
}: {
  workspace: SupportWorkspace;
  conversations: SupportConversation[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InboxStatus>("all");

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return conversations.filter((conversation) => {
      if (status !== "all" && conversation.status !== status) return false;
      if (!normalized) return true;
      return [
        conversation.subject,
        conversation.last_message_preview,
        conversation.contact?.name,
        conversation.queue?.name,
        conversation.agent?.name,
        conversation.channel?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized);
    });
  }, [conversations, query, status]);

  const selected =
    conversations.find((conversation) => conversation.id === selectedId) ??
    conversations[0] ??
    null;

  return (
    <div className="grid min-h-[42rem] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-sm border bg-card">
        <div className="space-y-3 border-b p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4" /> Atendimentos
              </h2>
              <p className="text-xs text-muted-foreground">
                {conversations.length} conversa(s) no contexto atual
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Contato, assunto ou fila"
              aria-label="Buscar atendimentos"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={status === item.value ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setStatus(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="h-[34rem] xl:h-[calc(100vh-22rem)] xl:min-h-[34rem]">
          <div className="divide-y">
            {visibleConversations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nenhum atendimento neste filtro</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste a busca ou escolha outro status. Conversas reais aparecem aqui quando um
                  canal registra atendimento.
                </p>
              </div>
            ) : (
              visibleConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`w-full p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    selected?.id === conversation.id ? "bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {conversation.contact?.name ?? "Contato indisponível"}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatActivity(conversation.last_activity_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm">{conversation.subject || "Sem assunto"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {conversation.last_message_preview || "Conversa sem mensagem de prévia."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={conversation.status} />
                    {conversation.queue?.name ? (
                      <Badge variant="outline">{conversation.queue.name}</Badge>
                    ) : null}
                    {conversation.priority === "urgent" || conversation.priority === "critical" ? (
                      <Badge variant="destructive">{conversation.priority}</Badge>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {selected ? (
        <SupportConversationPanel
          key={selected.id}
          conversationId={selected.id}
          summary={selected}
          workspace={workspace}
        />
      ) : (
        <div className="flex min-h-[32rem] items-center justify-center rounded-sm border bg-card p-8 text-center">
          <div>
            <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Selecione um atendimento</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              A conversa, as mensagens, o responsável, a fila e as ações aparecem neste painel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
