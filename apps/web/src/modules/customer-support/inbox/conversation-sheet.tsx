import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, MessageSquareReply, NotebookPen, TicketPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/components/ui/badge";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { StatusPill } from "@/shared/components/ui-kit";
import {
  addSupportConversationNote,
  assignSupportConversation,
  createSupportTicket,
  getSupportConversation,
  replySupportConversation,
  SupportApiError,
  transitionSupportConversation,
} from "../api";
import type { SupportMessage } from "../contracts";
import { SupportTicketDialog } from "../tickets/ticket-dialog";
import type {
  SupportConversation,
  SupportConversationStatus,
  SupportPriority,
  SupportWorkspace,
} from "../types";

const NONE_VALUE = "__none__";
const CONVERSATION_STATUSES: SupportConversationStatus[] = [
  "new",
  "automation",
  "waiting_for_customer",
  "waiting_for_agent",
  "open",
  "pending",
  "resolved",
  "closed",
];
const PRIORITIES: SupportPriority[] = ["low", "normal", "high", "urgent", "critical"];

function errorMessage(error: unknown) {
  if (error instanceof SupportApiError) {
    return error.requestId ? `${error.message} (requisição ${error.requestId})` : error.message;
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageLabel(message: SupportMessage) {
  if (message.direction === "internal") return "Nota interna";
  if (message.sender_type === "customer") return "Cliente";
  if (message.sender_type === "automation") return "Automação";
  if (message.sender_type === "system") return "Sistema";
  return "Atendimento";
}

function MessageCard({ message }: { message: SupportMessage }) {
  const isInternal = message.direction === "internal";
  const isOutbound = message.direction === "outbound";

  return (
    <div
      className={`rounded-sm border p-3 ${
        isInternal ? "border-dashed bg-muted/50" : isOutbound ? "ml-6 bg-primary/5" : "mr-6"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{messageLabel(message)}</span>
          <Badge variant="outline">{message.delivery_status}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
        {message.body ||
          (message.attachments.length > 0 ? "Mensagem com anexo." : "Evento sem texto.")}
      </p>
    </div>
  );
}

interface SupportConversationPanelProps {
  conversationId: string | null;
  summary: SupportConversation | null;
  workspace: SupportWorkspace;
}

export function SupportConversationPanel({
  conversationId,
  summary,
  workspace,
}: SupportConversationPanelProps) {
  const queryClient = useQueryClient();
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [messageBody, setMessageBody] = useState("");
  const [queueId, setQueueId] = useState<string | null>(null);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportConversationStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState<SupportPriority | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["support-conversation", conversationId],
    queryFn: () => getSupportConversation(conversationId as string),
    enabled: Boolean(conversationId),
  });
  const conversationDetail = detail.data;
  const conversation = conversationDetail?.conversation;

  const selectedQueueId = queueId ?? conversation?.current_queue_id ?? NONE_VALUE;
  const selectedAgentUserId = agentUserId ?? conversation?.current_agent_user_id ?? NONE_VALUE;
  const selectedNextStatus = nextStatus ?? conversation?.status ?? "open";
  const selectedTicketPriority = ticketPriority ?? conversation?.priority ?? "normal";

  const activeQueues = useMemo(
    () => workspace.queues.filter((queue) => queue.status === "active"),
    [workspace.queues],
  );
  const activeAgents = useMemo(
    () =>
      workspace.productMembers
        .filter((member) => member.status === "active" && member.operation_role !== "viewer")
        .map((member) => ({
          member,
          profile: workspace.profiles.find((profile) => profile.id === member.user_id),
        })),
    [workspace.productMembers, workspace.profiles],
  );

  const invalidateConversation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["support-conversation", conversationId] }),
      queryClient.invalidateQueries({ queryKey: ["support-inbox", workspace.product.id] }),
    ]);
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("Conversa indisponível.");
      const body = messageBody.trim();
      if (!body) throw new Error("Digite uma mensagem.");
      return composerMode === "reply"
        ? replySupportConversation({
            conversationId: conversation.id,
            expectedVersion: conversation.version,
            body,
            contentType: "text",
            attachments: [],
          })
        : addSupportConversationNote({
            conversationId: conversation.id,
            expectedVersion: conversation.version,
            note: body,
          });
    },
    onSuccess: async () => {
      setMessageBody("");
      await invalidateConversation();
      toast.success(composerMode === "reply" ? "Resposta registrada." : "Nota interna registrada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const assignConversation = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("Conversa indisponível.");
      return assignSupportConversation({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
        queueId: selectedQueueId === NONE_VALUE ? undefined : selectedQueueId,
        agentUserId: selectedAgentUserId === NONE_VALUE ? undefined : selectedAgentUserId,
        reason: assignmentReason.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setQueueId(null);
      setAgentUserId(null);
      setAssignmentReason("");
      await invalidateConversation();
      toast.success("Atribuição atualizada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const transitionConversation = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("Conversa indisponível.");
      if (selectedNextStatus === "closed" && !transitionReason.trim()) {
        throw new Error("Informe o motivo do encerramento.");
      }
      return transitionSupportConversation({
        conversationId: conversation.id,
        expectedVersion: conversation.version,
        status: selectedNextStatus,
        reason: transitionReason.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setNextStatus(null);
      setTransitionReason("");
      await invalidateConversation();
      toast.success("Status da conversa atualizado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("Conversa indisponível.");
      const title = ticketTitle.trim();
      if (!title) throw new Error("Informe o título do ticket.");
      return createSupportTicket({
        productId: conversation.product_id,
        conversationId: conversation.id,
        queueId: selectedQueueId === NONE_VALUE ? undefined : selectedQueueId,
        agentUserId: selectedAgentUserId === NONE_VALUE ? undefined : selectedAgentUserId,
        priority: selectedTicketPriority,
        title,
        description: ticketDescription.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setTicketTitle("");
      setTicketDescription("");
      setTicketPriority(null);
      await invalidateConversation();
      toast.success("Ticket criado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const operationPending =
    sendMessage.isPending ||
    assignConversation.isPending ||
    transitionConversation.isPending ||
    createTicket.isPending;

  return (
    <>
      <div className="min-w-0 overflow-hidden rounded-sm border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">{summary?.subject || "Conversa de atendimento"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary?.contact?.name || "Contato"} · {summary?.channel?.name || "Canal"}
          </p>
        </div>

        {detail.isLoading ? (
          <div className="flex min-h-[32rem] items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail.isError ? (
          <div className="m-4 rounded-sm border border-destructive/40 p-4 text-sm text-destructive">
            {errorMessage(detail.error)}
          </div>
        ) : conversation && conversationDetail ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 rounded-sm border p-3">
              <StatusPill status={conversation.status} />
              <Badge variant="outline">{conversation.priority}</Badge>
              <span className="text-xs text-muted-foreground">
                Atualizada em {formatDate(conversation.last_activity_at)} · versão{" "}
                {conversation.version}
              </span>
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Histórico</h3>
                <p className="text-xs text-muted-foreground">
                  Mensagens persistidas em ordem cronológica.
                </p>
              </div>
              <div className="max-h-[36rem] space-y-2 overflow-y-auto rounded-sm border p-3">
                {conversationDetail.messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem registrada.
                  </p>
                ) : (
                  conversationDetail.messages.map((message) => (
                    <MessageCard key={message.id} message={message} />
                  ))
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-sm border p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={composerMode === "reply" ? "default" : "outline"}
                  onClick={() => setComposerMode("reply")}
                >
                  <MessageSquareReply className="h-4 w-4" /> Responder
                </Button>
                <Button
                  size="sm"
                  variant={composerMode === "note" ? "default" : "outline"}
                  onClick={() => setComposerMode("note")}
                >
                  <NotebookPen className="h-4 w-4" /> Nota interna
                </Button>
              </div>
              <Textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder={
                  composerMode === "reply"
                    ? "Digite a resposta ao contato"
                    : "Registre uma observação visível somente para a equipe"
                }
                rows={5}
                disabled={conversation.status === "closed" || operationPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={
                    !messageBody.trim() || conversation.status === "closed" || operationPending
                  }
                  onClick={() => sendMessage.mutate()}
                >
                  {sendMessage.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {composerMode === "reply" ? "Enviar resposta" : "Salvar nota"}
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-sm border p-4">
              <div>
                <h3 className="text-sm font-semibold">Atribuição</h3>
                <p className="text-xs text-muted-foreground">
                  A alteração encerra a atribuição anterior e registra uma nova entrada auditável.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fila</Label>
                  <Select
                    value={selectedQueueId}
                    onValueChange={setQueueId}
                    disabled={operationPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Sem fila</SelectItem>
                      {activeQueues.map((queue) => (
                        <SelectItem key={queue.id} value={queue.id}>
                          {queue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Agente</Label>
                  <Select
                    value={selectedAgentUserId}
                    onValueChange={setAgentUserId}
                    disabled={operationPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Não atribuído</SelectItem>
                      {activeAgents.map(({ member, profile }) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {profile?.displayName || profile?.email || member.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                value={assignmentReason}
                onChange={(event) => setAssignmentReason(event.target.value)}
                placeholder="Motivo da atribuição ou transferência"
                disabled={operationPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={operationPending}
                  onClick={() => assignConversation.mutate()}
                >
                  {assignConversation.isPending && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Atualizar atribuição
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-sm border p-4">
              <div>
                <h3 className="text-sm font-semibold">Estado da conversa</h3>
                <p className="text-xs text-muted-foreground">
                  Encerramento exige motivo; conversa encerrada só pode ser reaberta como aberta.
                </p>
              </div>
              <Select
                value={selectedNextStatus}
                onValueChange={(value) => setNextStatus(value as SupportConversationStatus)}
                disabled={operationPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONVERSATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={transitionReason}
                onChange={(event) => setTransitionReason(event.target.value)}
                placeholder={
                  selectedNextStatus === "closed"
                    ? "Motivo obrigatório do encerramento"
                    : "Motivo da alteração"
                }
                disabled={operationPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    operationPending ||
                    selectedNextStatus === conversation.status ||
                    (selectedNextStatus === "closed" && !transitionReason.trim())
                  }
                  onClick={() => transitionConversation.mutate()}
                >
                  {transitionConversation.isPending && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Alterar status
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-sm border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Tickets relacionados</h3>
                  <p className="text-xs text-muted-foreground">
                    {conversationDetail.tickets.length} ticket(s) vinculado(s) à conversa.
                  </p>
                </div>
                <TicketPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              {conversationDetail.tickets.length > 0 && (
                <div className="space-y-2">
                  {conversationDetail.tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-sm bg-muted/50 p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <div>
                        <p className="font-medium">
                          {ticket.ticket_number} · {ticket.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.priority} · criado em {formatDate(ticket.created_at)}
                        </p>
                      </div>
                      <StatusPill status={ticket.status} />
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Título do novo ticket</Label>
                  <Input
                    value={ticketTitle}
                    onChange={(event) => setTicketTitle(event.target.value)}
                    disabled={operationPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={selectedTicketPriority}
                    onValueChange={(value) => setTicketPriority(value as SupportPriority)}
                    disabled={operationPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={ticketDescription}
                onChange={(event) => setTicketDescription(event.target.value)}
                placeholder="Descrição objetiva do atendimento necessário"
                rows={4}
                disabled={operationPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!ticketTitle.trim() || operationPending}
                  onClick={() => createTicket.mutate()}
                >
                  {createTicket.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Criar ticket
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
      <SupportTicketDialog
        open={Boolean(selectedTicketId)}
        ticketId={selectedTicketId}
        conversationId={conversationId}
        workspace={workspace}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedTicketId(null);
        }}
      />
    </>
  );
}
