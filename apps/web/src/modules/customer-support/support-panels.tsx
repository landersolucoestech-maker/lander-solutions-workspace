import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import type { SupportConversation, SupportWorkspace } from "./types";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function SupportOverview({
  workspace,
  inboxCount,
}: {
  workspace: SupportWorkspace;
  inboxCount: number;
}) {
  const activeQueues = workspace.queues.filter((queue) => queue.status === "active").length;
  const activeAgents = workspace.productMembers.filter(
    (member) => member.status === "active" && member.operation_role !== "viewer",
  ).length;
  const activeChannels = workspace.channels.filter((channel) => channel.status === "active").length;
  const published = workspace.automationVersions.find((version) => version.status === "published");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Conversas" value={String(inboxCount)} hint="Produto selecionado" />
        <Kpi
          label="Filas ativas"
          value={String(activeQueues)}
          hint="Específicas ou compartilhadas"
        />
        <Kpi label="Agentes ativos" value={String(activeAgents)} hint="Com vínculo operacional" />
        <Kpi
          label="Canais ativos"
          value={String(activeChannels)}
          hint={
            published
              ? `Automação v${published.version_number} publicada`
              : "Sem automação publicada"
          }
          tone={published ? "positive" : "warning"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Estado operacional" description="Configuração real do produto selecionado.">
          <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Marca</p>
              <p className="mt-1 font-medium">{workspace.settings.brand_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unidade</p>
              <p className="mt-1 font-medium">{workspace.scope.unitCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timezone</p>
              <p className="mt-1 font-medium">{workspace.settings.timezone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Idioma</p>
              <p className="mt-1 font-medium">{workspace.settings.default_language}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Automação</p>
              <p className="mt-1 font-medium">
                {workspace.settings.automation_enabled ? "Ativa" : "Desativada"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produto</p>
              <p className="mt-1 font-medium">{workspace.product.name}</p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Pendências de configuração"
          description="Itens que impedem a operação completa."
        >
          <div className="space-y-2 p-4 text-sm">
            {activeQueues === 0 && <p>Crie ao menos uma fila ativa.</p>}
            {activeAgents === 0 && <p>Vincule agentes ativos ao produto.</p>}
            {workspace.channels.length === 0 && <p>Cadastre um canal real ou manual.</p>}
            {workspace.slaPolicies.length === 0 && <p>Defina uma política de SLA.</p>}
            {!published && <p>Crie, valide e publique uma automação.</p>}
            {activeQueues > 0 &&
              activeAgents > 0 &&
              workspace.channels.length > 0 &&
              workspace.slaPolicies.length > 0 &&
              published && <p>Configuração operacional mínima concluída.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function SupportInbox({
  conversations,
  onOpenConversation,
}: {
  conversations: SupportConversation[];
  onOpenConversation: (conversation: SupportConversation) => void;
}) {
  return (
    <Panel
      title="Caixa de entrada"
      description="Selecione uma conversa para responder, atribuir, alterar o status ou criar ticket."
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Fila / agente</TableHead>
              <TableHead>Última mensagem</TableHead>
              <TableHead>Atualização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhuma conversa encontrada. O sistema não cria conversas fictícias.
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conversation) => (
                <TableRow
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpenConversation(conversation)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenConversation(conversation);
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {conversation.contact?.name ?? "Contato indisponível"}
                  </TableCell>
                  <TableCell>{conversation.subject || "Sem assunto"}</TableCell>
                  <TableCell>
                    <StatusPill status={conversation.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{conversation.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <p>{conversation.queue?.name ?? "Sem fila"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conversation.agent?.name ?? "Não atribuído"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-96 truncate">
                    {conversation.last_message_preview || "—"}
                  </TableCell>
                  <TableCell>{formatDate(conversation.last_activity_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

export function SupportCatalog({ workspace }: { workspace: SupportWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Filas e equipes" description="Filas reais e estratégias de distribuição.">
        <div className="divide-y">
          {workspace.queues.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma fila cadastrada.</p>
          ) : (
            workspace.queues.map((queue) => (
              <div key={queue.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{queue.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {queue.code} · {queue.distribution_strategy}
                  </p>
                </div>
                <StatusPill status={queue.status} />
              </div>
            ))
          )}
        </div>
      </Panel>
      <Panel title="Agentes" description="Usuários reais vinculados ao produto.">
        <div className="divide-y">
          {workspace.productMembers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum agente vinculado.</p>
          ) : (
            workspace.productMembers.map((member) => {
              const profile = workspace.profiles.find((item) => item.id === member.user_id);
              return (
                <div key={member.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{profile?.displayName ?? "Usuário indisponível"}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.operation_role} · capacidade {member.capacity}
                    </p>
                  </div>
                  <StatusPill status={member.status} />
                </div>
              );
            })
          )}
        </div>
      </Panel>
      <Panel title="Formulários e templates" description="Estruturas relacionais e versionadas.">
        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Formulários</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.forms.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Templates</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.templates.length}</p>
          </div>
        </div>
      </Panel>
      <Panel
        title="Horários, SLA e canais"
        description="Políticas calculadas e estado real das integrações."
      >
        <div className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Calendários</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.businessHours.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">SLAs</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.slaPolicies.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canais</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.channels.length}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
