import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Panel, StatusPill } from "@/shared/components/ui-kit";
import type {
  SupportChannel,
  SupportProductMember,
  SupportQueue,
  SupportWorkspace,
} from "../types";
import { MemberEditor } from "./agents/member-editor";
import { ChannelEditor } from "./channels/channel-editor";
import { QueueEditor } from "./queues/queue-editor";
import { ProductSettingsEditor } from "./settings/product-settings-editor";

export function SupportCoreAdministration({ workspace }: { workspace: SupportWorkspace }) {
  const [queueEditor, setQueueEditor] = useState<SupportQueue | "new" | null>(null);
  const [memberEditor, setMemberEditor] = useState<SupportProductMember | "new" | null>(null);
  const [channelEditor, setChannelEditor] = useState<SupportChannel | "new" | null>(null);

  return (
    <Tabs defaultValue="settings" className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
        <TabsTrigger value="settings">Configurações</TabsTrigger>
        <TabsTrigger value="queues">Filas</TabsTrigger>
        <TabsTrigger value="agents">Agentes</TabsTrigger>
        <TabsTrigger value="channels">Canais</TabsTrigger>
      </TabsList>
      <TabsContent value="settings">
        <ProductSettingsEditor key={workspace.settings.version} workspace={workspace} />
      </TabsContent>
      <TabsContent value="queues">
        <Panel
          title="Filas e equipes"
          description="Filas relacionais do produto, sem nomes fixos no frontend."
          actions={
            <Button size="sm" onClick={() => setQueueEditor("new")}>
              <Plus className="h-4 w-4" /> Nova fila
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Estratégia</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.queues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhuma fila cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.queues.map((queue) => (
                    <TableRow key={queue.id}>
                      <TableCell>
                        <p className="font-medium">{queue.name}</p>
                        <p className="text-xs text-muted-foreground">{queue.code}</p>
                      </TableCell>
                      <TableCell>{queue.distribution_strategy}</TableCell>
                      <TableCell>{queue.default_priority}</TableCell>
                      <TableCell>
                        <StatusPill status={queue.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setQueueEditor(queue)}>
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </TabsContent>
      <TabsContent value="agents">
        <Panel
          title="Agentes do produto"
          description="Usuários ativos vinculados ao produto e elegíveis para atendimento."
          actions={
            <Button size="sm" onClick={() => setMemberEditor("new")}>
              <Plus className="h-4 w-4" /> Vincular agente
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Disponibilidade</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.productMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhum agente vinculado.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.productMembers.map((member) => {
                    const profile = workspace.profiles.find((item) => item.id === member.user_id);
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-medium">
                            {profile?.displayName ?? "Usuário indisponível"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profile?.email ?? "Sem e-mail"}
                          </p>
                        </TableCell>
                        <TableCell>{member.operation_role}</TableCell>
                        <TableCell>{member.availability_status}</TableCell>
                        <TableCell>{member.capacity}</TableCell>
                        <TableCell>
                          <StatusPill status={member.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMemberEditor(member)}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </TabsContent>
      <TabsContent value="channels">
        <Panel
          title="Canais de atendimento"
          description="Estados explícitos; integrações externas não são simuladas."
          actions={
            <Button size="sm" onClick={() => setChannelEditor("new")}>
              <Plus className="h-4 w-4" /> Cadastrar canal
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.channels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhum canal cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.channels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell className="font-medium">{channel.name}</TableCell>
                      <TableCell>{channel.channel_type}</TableCell>
                      <TableCell>{channel.provider ?? "—"}</TableCell>
                      <TableCell>
                        <StatusPill status={channel.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setChannelEditor(channel)}
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </TabsContent>
      {queueEditor ? (
        <QueueEditor
          key={queueEditor === "new" ? "new" : `${queueEditor.id}-${queueEditor.version}`}
          workspace={workspace}
          record={queueEditor === "new" ? null : queueEditor}
          open
          onOpenChange={(open) => {
            if (!open) setQueueEditor(null);
          }}
        />
      ) : null}
      {memberEditor ? (
        <MemberEditor
          key={memberEditor === "new" ? "new" : `${memberEditor.id}-${memberEditor.version}`}
          workspace={workspace}
          record={memberEditor === "new" ? null : memberEditor}
          open
          onOpenChange={(open) => {
            if (!open) setMemberEditor(null);
          }}
        />
      ) : null}
      {channelEditor ? (
        <ChannelEditor
          key={channelEditor === "new" ? "new" : `${channelEditor.id}-${channelEditor.version}`}
          workspace={workspace}
          record={channelEditor === "new" ? null : channelEditor}
          open
          onOpenChange={(open) => {
            if (!open) setChannelEditor(null);
          }}
        />
      ) : null}
    </Tabs>
  );
}
