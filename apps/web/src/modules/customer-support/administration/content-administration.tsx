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
  SupportBusinessHours,
  SupportForm,
  SupportSlaPolicy,
  SupportTemplate,
  SupportWorkspace,
} from "../types";
import { FormEditor } from "./forms/form-editor";
import { BusinessHoursEditor } from "./schedules/business-hours-editor";
import { EscalationEditor, type EscalationRecord } from "./sla/escalation-editor";
import { SlaEditor } from "./sla/sla-editor";
import { TemplateEditor } from "./templates/template-editor";

export function SupportContentAdministration({ workspace }: { workspace: SupportWorkspace }) {
  const [templateEditor, setTemplateEditor] = useState<SupportTemplate | "new" | null>(null);
  const [formEditor, setFormEditor] = useState<SupportForm | "new" | null>(null);
  const [hoursEditor, setHoursEditor] = useState<SupportBusinessHours | "new" | null>(null);
  const [slaEditor, setSlaEditor] = useState<SupportSlaPolicy | "new" | null>(null);
  const [escalationEditor, setEscalationEditor] = useState<EscalationRecord | "new" | null>(null);
  return (
    <Tabs defaultValue="templates" className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="forms">Formulários</TabsTrigger>
        <TabsTrigger value="hours">Horários</TabsTrigger>
        <TabsTrigger value="sla">SLA</TabsTrigger>
        <TabsTrigger value="escalations">Escalonamentos</TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <Panel
          title="Templates de mensagens"
          description="Conteúdo versionado e variáveis autorizadas."
          actions={
            <Button size="sm" onClick={() => setTemplateEditor("new")}>
              <Plus className="h-4 w-4" /> Novo template
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhum template cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.templates.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.code}</p>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.channel_type ?? "Todos"}</TableCell>
                      <TableCell>v{item.template_version}</TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setTemplateEditor(item)}>
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
      <TabsContent value="forms">
        <Panel
          title="Formulários estruturados"
          description="Campos versionados com chaves estáveis."
          actions={
            <Button size="sm" onClick={() => setFormEditor("new")}>
              <Plus className="h-4 w-4" /> Novo formulário
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Campos</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.forms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhum formulário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.forms.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.code}</p>
                      </TableCell>
                      <TableCell>
                        {workspace.formFields.filter((field) => field.form_id === item.id).length}
                      </TableCell>
                      <TableCell>v{item.form_version}</TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setFormEditor(item)}>
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
      <TabsContent value="hours">
        <Panel
          title="Horários de atendimento"
          description="Calendários por produto com intervalos e feriados."
          actions={
            <Button size="sm" onClick={() => setHoursEditor("new")}>
              <Plus className="h-4 w-4" /> Novo horário
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Calendário</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.businessHours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhum calendário cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.businessHours.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.timezone}</TableCell>
                      <TableCell>
                        {item.is_24_hours
                          ? "24 horas"
                          : `${workspace.businessHourIntervals.filter((interval) => interval.business_hours_id === item.id).length} intervalos`}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setHoursEditor(item)}>
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
      <TabsContent value="sla">
        <Panel
          title="Políticas de SLA"
          description="Metas de primeira resposta, próxima resposta e resolução."
          actions={
            <Button size="sm" onClick={() => setSlaEditor("new")}>
              <Plus className="h-4 w-4" /> Novo SLA
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Política</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Primeira resposta</TableHead>
                  <TableHead>Resolução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.slaPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhuma política cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.slaPolicies.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.priority ?? "Todas"}</TableCell>
                      <TableCell>{item.first_response_minutes} min</TableCell>
                      <TableCell>{item.resolution_minutes} min</TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSlaEditor(item)}>
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
      <TabsContent value="escalations">
        <Panel
          title="Regras de escalonamento"
          description="Regras persistidas, idempotentes e executadas pelo backend."
          actions={
            <Button size="sm" onClick={() => setEscalationEditor("new")}>
              <Plus className="h-4 w-4" /> Nova regra
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.escalationRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhuma regra cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.escalationRules.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.event_type}</TableCell>
                      <TableCell>{item.elapsed_minutes} min</TableCell>
                      <TableCell>{item.delivery_channels.join(", ")}</TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEscalationEditor(item)}
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
      {templateEditor ? (
        <TemplateEditor
          key={templateEditor === "new" ? "new" : `${templateEditor.id}-${templateEditor.version}`}
          workspace={workspace}
          record={templateEditor === "new" ? null : templateEditor}
          open
          onOpenChange={(value) => {
            if (!value) setTemplateEditor(null);
          }}
        />
      ) : null}
      {formEditor ? (
        <FormEditor
          key={formEditor === "new" ? "new" : `${formEditor.id}-${formEditor.version}`}
          workspace={workspace}
          record={formEditor === "new" ? null : formEditor}
          open
          onOpenChange={(value) => {
            if (!value) setFormEditor(null);
          }}
        />
      ) : null}
      {hoursEditor ? (
        <BusinessHoursEditor
          key={hoursEditor === "new" ? "new" : `${hoursEditor.id}-${hoursEditor.version}`}
          workspace={workspace}
          record={hoursEditor === "new" ? null : hoursEditor}
          open
          onOpenChange={(value) => {
            if (!value) setHoursEditor(null);
          }}
        />
      ) : null}
      {slaEditor ? (
        <SlaEditor
          key={slaEditor === "new" ? "new" : `${slaEditor.id}-${slaEditor.version}`}
          workspace={workspace}
          record={slaEditor === "new" ? null : slaEditor}
          open
          onOpenChange={(value) => {
            if (!value) setSlaEditor(null);
          }}
        />
      ) : null}
      {escalationEditor ? (
        <EscalationEditor
          key={
            escalationEditor === "new"
              ? "new"
              : `${escalationEditor.id}-${escalationEditor.version}`
          }
          workspace={workspace}
          record={escalationEditor === "new" ? null : escalationEditor}
          open
          onOpenChange={(value) => {
            if (!value) setEscalationEditor(null);
          }}
        />
      ) : null}
    </Tabs>
  );
}
