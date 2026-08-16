import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/shared/components/ui/textarea";
import { StatusPill } from "@/shared/components/ui-kit";
import { getSupportTicket, SupportApiError, transitionSupportTicket } from "../api";
import type { SupportTicketStatus } from "../contracts";
import type { SupportPriority, SupportWorkspace } from "../types";

const NONE_VALUE = "__none__";
const ACTIVE_TICKET_STATUSES: Exclude<SupportTicketStatus, "resolved" | "closed">[] = [
  "new",
  "open",
  "pending",
  "waiting_for_customer",
  "waiting_for_agent",
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

interface SupportTicketDialogProps {
  open: boolean;
  ticketId: string | null;
  conversationId: string | null;
  workspace: SupportWorkspace;
  onOpenChange: (open: boolean) => void;
}

export function SupportTicketDialog({
  open,
  ticketId,
  conversationId,
  workspace,
  onOpenChange,
}: SupportTicketDialogProps) {
  const queryClient = useQueryClient();
  const [queueOverride, setQueueOverride] = useState<string | null>(null);
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const [priorityOverride, setPriorityOverride] = useState<SupportPriority | null>(null);
  const [statusOverride, setStatusOverride] = useState<Exclude<
    SupportTicketStatus,
    "resolved" | "closed"
  > | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const detail = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => getSupportTicket(ticketId as string),
    enabled: open && Boolean(ticketId),
  });
  const ticketDetail = detail.data;
  const ticket = ticketDetail?.ticket;
  const selectedQueueId = queueOverride ?? ticket?.queue_id ?? NONE_VALUE;
  const selectedAgentId = agentOverride ?? ticket?.agent_user_id ?? NONE_VALUE;
  const selectedPriority = priorityOverride ?? ticket?.priority ?? "normal";
  const selectedStatus =
    statusOverride ??
    (ticket && ticket.status !== "resolved" && ticket.status !== "closed" ? ticket.status : "open");

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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] }),
      queryClient.invalidateQueries({ queryKey: ["support-conversation", conversationId] }),
      queryClient.invalidateQueries({ queryKey: ["support-inbox", workspace.product.id] }),
    ]);
  };

  const transition = useMutation({
    mutationFn: async (
      command:
        | { kind: "assign" }
        | { kind: "priority" }
        | { kind: "status" }
        | { kind: "resolve" }
        | { kind: "reopen" }
        | { kind: "close" }
        | { kind: "note" },
    ) => {
      if (!ticket) throw new Error("Ticket indisponível.");
      switch (command.kind) {
        case "assign":
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "assign",
            payload: {
              queueId: selectedQueueId === NONE_VALUE ? undefined : selectedQueueId,
              agentUserId: selectedAgentId === NONE_VALUE ? undefined : selectedAgentId,
              reason: reason.trim() || undefined,
            },
          });
        case "priority":
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "priority",
            payload: { priority: selectedPriority },
          });
        case "status":
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "status",
            payload: { status: selectedStatus },
          });
        case "resolve":
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "resolve",
            payload: {},
          });
        case "reopen":
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "reopen",
            payload: {},
          });
        case "close": {
          const closureReason = reason.trim();
          if (!closureReason) throw new Error("Informe o motivo do encerramento.");
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "close",
            payload: { reason: closureReason },
          });
        }
        case "note": {
          const internalNote = note.trim();
          if (!internalNote) throw new Error("Digite a nota interna.");
          return transitionSupportTicket({
            ticketId: ticket.id,
            expectedVersion: ticket.version,
            transition: "internal_note",
            payload: { note: internalNote },
          });
        }
      }
    },
    onSuccess: async (_, command) => {
      if (command.kind === "assign") {
        setQueueOverride(null);
        setAgentOverride(null);
        setReason("");
      }
      if (command.kind === "priority") setPriorityOverride(null);
      if (command.kind === "status") setStatusOverride(null);
      if (command.kind === "close") setReason("");
      if (command.kind === "note") setNote("");
      await invalidate();
      toast.success("Ticket atualizado.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetLocalState = () => {
    setQueueOverride(null);
    setAgentOverride(null);
    setPriorityOverride(null);
    setStatusOverride(null);
    setReason("");
    setNote("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetLocalState();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {ticket ? `${ticket.ticket_number} · ${ticket.title}` : "Ticket"}
          </DialogTitle>
          <DialogDescription>
            Operação versionada, autorizada e registrada na trilha de eventos.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail.isError ? (
          <div className="rounded-sm border border-destructive/40 p-4 text-sm text-destructive">
            {errorMessage(detail.error)}
          </div>
        ) : ticket && ticketDetail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-sm border p-3">
              <StatusPill status={ticket.status} />
              <Badge variant="outline">{ticket.priority}</Badge>
              <span className="text-xs text-muted-foreground">
                Atualizado em {formatDate(ticket.updated_at)} · versão {ticket.version}
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="space-y-3 rounded-sm border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Atribuição</h3>
                  <p className="text-xs text-muted-foreground">Fila e agente responsáveis.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fila</Label>
                    <Select
                      value={selectedQueueId}
                      onValueChange={setQueueOverride}
                      disabled={transition.isPending}
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
                      value={selectedAgentId}
                      onValueChange={setAgentOverride}
                      disabled={transition.isPending}
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
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo da transferência ou encerramento"
                  disabled={transition.isPending}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ kind: "assign" })}
                >
                  Atualizar atribuição
                </Button>
              </section>

              <section className="space-y-3 rounded-sm border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Prioridade e status</h3>
                  <p className="text-xs text-muted-foreground">
                    Atualizações operacionais do ticket.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={selectedPriority}
                      onValueChange={(value) => setPriorityOverride(value as SupportPriority)}
                      disabled={transition.isPending}
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={transition.isPending || selectedPriority === ticket.priority}
                      onClick={() => transition.mutate({ kind: "priority" })}
                    >
                      Alterar prioridade
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Status ativo</Label>
                    <Select
                      value={selectedStatus}
                      onValueChange={(value) =>
                        setStatusOverride(
                          value as Exclude<SupportTicketStatus, "resolved" | "closed">,
                        )
                      }
                      disabled={transition.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVE_TICKET_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={transition.isPending || selectedStatus === ticket.status}
                      onClick={() => transition.mutate({ kind: "status" })}
                    >
                      Alterar status
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ticket.status !== "resolved" && ticket.status !== "closed" && (
                    <Button
                      size="sm"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate({ kind: "resolve" })}
                    >
                      Resolver
                    </Button>
                  )}
                  {(ticket.status === "resolved" || ticket.status === "closed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate({ kind: "reopen" })}
                    >
                      Reabrir
                    </Button>
                  )}
                  {ticket.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={transition.isPending || !reason.trim()}
                      onClick={() => transition.mutate({ kind: "close" })}
                    >
                      Encerrar
                    </Button>
                  )}
                </div>
              </section>
            </div>

            <section className="space-y-3 rounded-sm border p-4">
              <div>
                <h3 className="text-sm font-semibold">Nota interna</h3>
                <p className="text-xs text-muted-foreground">
                  Registro operacional visível à equipe.
                </p>
              </div>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                disabled={transition.isPending}
              />
              <Button
                size="sm"
                disabled={transition.isPending || !note.trim()}
                onClick={() => transition.mutate({ kind: "note" })}
              >
                Registrar nota
              </Button>
            </section>

            <section className="space-y-3 rounded-sm border p-4">
              <div>
                <h3 className="text-sm font-semibold">Histórico do ticket</h3>
                <p className="text-xs text-muted-foreground">
                  {ticketDetail.events.length} evento(s) persistido(s).
                </p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {ticketDetail.events.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sem eventos.</p>
                ) : (
                  ticketDetail.events.map((event) => (
                    <div key={event.id} className="rounded-sm bg-muted/50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{event.event_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.occurred_at)}
                        </span>
                      </div>
                      {Object.keys(event.payload).length > 0 && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
