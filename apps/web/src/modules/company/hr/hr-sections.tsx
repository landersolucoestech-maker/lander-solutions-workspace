import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus, ShieldOff, Upload } from "lucide-react";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { EmptyRow, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import type { HrActionState } from "./hr-action-dialogs";
import type { HrRecordActionState } from "./hr-record-dialog";
import type { EmployeeDirectoryRow, HrDirectory, HrOption, ProcessTask } from "./types";

interface SectionProps {
  data: HrDirectory;
  onAction: (action: HrActionState) => void;
  extraActions?: ReactNode;
  onRecordAction?: (action: HrRecordActionState) => void;
}

export function EmployeesSection({ data, extraActions, onRecordAction }: SectionProps) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.employees;
    return data.employees.filter((employee) =>
      [
        employee.display_name,
        employee.corporate_email,
        employee.unit_name,
        employee.department_name,
        employee.position_name,
        employee.manager_name,
        employee.employment_type,
        employee.work_mode,
        employee.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data.employees, search]);

  return (
    <Panel
      title="Colaboradores"
      description="Diretório profissional. Dados pessoais sensíveis são carregados somente sob autorização específica."
      actions={
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar colaborador"
            className="h-9 min-w-64 rounded-sm"
          />
          {extraActions}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-2 text-left font-semibold">Unidade</th>
              <th className="px-4 py-2 text-left font-semibold">Departamento</th>
              <th className="px-4 py-2 text-left font-semibold">Cargo</th>
              <th className="px-4 py-2 text-left font-semibold">Gestor</th>
              <th className="px-4 py-2 text-left font-semibold">Vínculo</th>
              <th className="px-4 py-2 text-left font-semibold">Modalidade</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={9} label="Nenhum colaborador encontrado." />}
            {rows.map((employee) => (
              <tr key={employee.employee_id} className="border-t align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{employee.display_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {employee.corporate_email ?? "E-mail corporativo não informado"}
                  </p>
                  <p className="num mt-1 text-xs text-muted-foreground">
                    Entrada: {formatDate(employee.hire_date)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <UnitTag>{employee.unit_code}</UnitTag>
                </td>
                <td className="px-4 py-3">{employee.department_name ?? "—"}</td>
                <td className="px-4 py-3">{employee.position_name ?? "—"}</td>
                <td className="px-4 py-3">{employee.manager_name ?? "—"}</td>
                <td className="px-4 py-3">{employee.employment_type}</td>
                <td className="px-4 py-3">{workModeLabel(employee.work_mode)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={statusLabel(employee.status)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionsMenu
                    onView={() =>
                      onRecordAction?.({ entity: "employee", action: "view", record: employee })
                    }
                    onEdit={() =>
                      onRecordAction?.({ entity: "employee", action: "edit", record: employee })
                    }
                    editDisabled={!data.permissions.manageEmployees}
                    onDelete={() =>
                      onRecordAction?.({ entity: "employee", action: "delete", record: employee })
                    }
                    deleteDisabled={
                      !data.permissions.manageEmployees || employee.status === "DESLIGADO"
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function DocumentsSection({ data, onAction, extraActions, onRecordAction }: SectionProps) {
  return (
    <Panel
      title="Documentos"
      description="Arquivos privados com URL temporária, visibilidade explícita e auditoria de download."
      actions={
        <div className="flex flex-wrap gap-2">
          {data.permissions.manageDocuments ? (
            <Button onClick={() => onAction({ kind: "upload-document" })}>
              <Upload /> Enviar documento
            </Button>
          ) : null}
          {extraActions}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Documento</th>
              <th className="px-4 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-2 text-left font-semibold">Tipo</th>
              <th className="px-4 py-2 text-left font-semibold">Visibilidade</th>
              <th className="px-4 py-2 text-left font-semibold">Validade</th>
              <th className="px-4 py-2 text-left font-semibold">Enviado</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.length === 0 && (
              <EmptyRow colSpan={7} label="Nenhum documento disponível." />
            )}
            {data.documents.map((document) => (
              <tr key={document.id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-medium">{document.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {document.original_file_name}
                  </p>
                </td>
                <td className="px-4 py-3">{employeeName(data, document.employee_id)}</td>
                <td className="px-4 py-3">
                  {optionName(data.documentTypes, document.document_type_id)}
                </td>
                <td className="px-4 py-3">{visibilityLabel(document.visibility)}</td>
                <td className="num px-4 py-3">
                  {document.expires_at ? formatDate(document.expires_at) : "Sem validade"}
                </td>
                <td className="num px-4 py-3">{formatDate(document.uploaded_at)}</td>
                <td className="px-4 py-3 text-right">
                  <RowActionsMenu
                    onView={() =>
                      onRecordAction?.({ entity: "document", action: "view", record: document })
                    }
                    onEdit={() =>
                      onRecordAction?.({ entity: "document", action: "edit", record: document })
                    }
                    editDisabled={!data.permissions.manageDocuments}
                    onDelete={() =>
                      onRecordAction?.({ entity: "document", action: "delete", record: document })
                    }
                    deleteDisabled={!data.permissions.manageDocuments}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function LeaveSection({ data, onAction, extraActions, onRecordAction }: SectionProps) {
  return (
    <Panel
      title="Férias e ausências"
      description="Solicitações, períodos, documentos obrigatórios e decisões sem autoaprovação."
      actions={
        <div className="flex flex-wrap gap-2">
          {data.permissions.manageLeave ? (
            <Button onClick={() => onAction({ kind: "create-leave" })}>
              <Plus /> Nova solicitação
            </Button>
          ) : null}
          {extraActions}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-2 text-left font-semibold">Tipo</th>
              <th className="px-4 py-2 text-left font-semibold">Período</th>
              <th className="px-4 py-2 text-right font-semibold">Dias</th>
              <th className="px-4 py-2 text-left font-semibold">Motivo</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.leaves.length === 0 && (
              <EmptyRow colSpan={7} label="Nenhuma solicitação cadastrada." />
            )}
            {data.leaves.map((request) => (
              <tr key={request.id} className="border-t align-top">
                <td className="px-4 py-3 font-medium">{employeeName(data, request.employee_id)}</td>
                <td className="px-4 py-3">{optionName(data.leaveTypes, request.leave_type_id)}</td>
                <td className="num px-4 py-3">
                  {formatDate(request.start_date)} — {formatDate(request.end_date)}
                </td>
                <td className="num px-4 py-3 text-right">{request.duration_days}</td>
                <td className="max-w-72 px-4 py-3 text-muted-foreground">
                  {request.reason ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={statusLabel(request.status)} />
                  {request.rejection_reason ? (
                    <p className="mt-1 text-xs text-destructive">{request.rejection_reason}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionsMenu
                    onView={() =>
                      onRecordAction?.({ entity: "leave", action: "view", record: request })
                    }
                    onEdit={() =>
                      onRecordAction?.({ entity: "leave", action: "edit", record: request })
                    }
                    editDisabled={!data.permissions.manageLeave || request.status === "APROVADO"}
                    onDelete={() =>
                      onRecordAction?.({ entity: "leave", action: "delete", record: request })
                    }
                    deleteDisabled={!data.permissions.manageLeave || request.status === "APROVADO"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function PaymentsSection({ data, onAction, extraActions, onRecordAction }: SectionProps) {
  return (
    <Panel
      title="Pagamentos administrativos"
      description="Valores calculados no servidor. Este controle não substitui a folha legal nem a contabilidade."
      actions={
        <div className="flex flex-wrap gap-2">
          {data.permissions.managePayments ? (
            <Button onClick={() => onAction({ kind: "create-payment" })}>
              <Plus /> Novo pagamento
            </Button>
          ) : null}
          {extraActions}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-2 text-left font-semibold">Competência</th>
              <th className="px-4 py-2 text-left font-semibold">Descrição</th>
              <th className="px-4 py-2 text-right font-semibold">Base</th>
              <th className="px-4 py-2 text-right font-semibold">Adicionais</th>
              <th className="px-4 py-2 text-right font-semibold">Descontos</th>
              <th className="px-4 py-2 text-right font-semibold">Final</th>
              <th className="px-4 py-2 text-left font-semibold">Previsto</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.length === 0 && (
              <EmptyRow colSpan={10} label="Nenhum pagamento cadastrado." />
            )}
            {data.payments.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="px-4 py-3 font-medium">{employeeName(data, payment.employee_id)}</td>
                <td className="num px-4 py-3">{formatMonth(payment.competence)}</td>
                <td className="px-4 py-3">{payment.description}</td>
                <td className="num px-4 py-3 text-right">{formatMoney(payment.base_amount)}</td>
                <td className="num px-4 py-3 text-right">{formatMoney(payment.additions)}</td>
                <td className="num px-4 py-3 text-right">
                  {formatMoney(payment.informational_deductions)}
                </td>
                <td className="num px-4 py-3 text-right font-semibold">
                  {formatMoney(payment.final_amount)}
                </td>
                <td className="num px-4 py-3">{formatDate(payment.expected_date)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={statusLabel(payment.status)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionsMenu
                    onView={() =>
                      onRecordAction?.({ entity: "payment", action: "view", record: payment })
                    }
                    onEdit={() =>
                      onRecordAction?.({ entity: "payment", action: "edit", record: payment })
                    }
                    editDisabled={
                      !data.permissions.managePayments ||
                      payment.status === "PAGO" ||
                      payment.status === "CANCELADO"
                    }
                    onDelete={() =>
                      onRecordAction?.({ entity: "payment", action: "delete", record: payment })
                    }
                    deleteDisabled={!data.permissions.managePayments || payment.status === "PAGO"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function OnboardingSection({ data, onAction }: SectionProps) {
  return (
    <Panel
      title="Onboarding"
      description="Checklist derivado, responsável, prazo e percentual calculado pelas tarefas."
      actions={
        data.permissions.manageOnboarding ? (
          <Button onClick={() => onAction({ kind: "create-onboarding" })}>
            <Plus /> Iniciar onboarding
          </Button>
        ) : null
      }
    >
      <ProcessCards
        data={data}
        kind="onboarding"
        tasks={data.onboardingTasks}
        onAction={onAction}
      />
    </Panel>
  );
}

export function OffboardingSection({ data, onAction }: SectionProps) {
  return (
    <Panel
      title="Desligamentos"
      description="Processo atômico com tarefas obrigatórias, devolução de equipamentos, revogação de acessos e inativação da conta."
      actions={
        data.permissions.manageOffboarding ? (
          <Button onClick={() => onAction({ kind: "create-offboarding" })}>
            <Plus /> Iniciar desligamento
          </Button>
        ) : null
      }
    >
      <ProcessCards
        data={data}
        kind="offboarding"
        tasks={data.offboardingTasks}
        onAction={onAction}
      />
    </Panel>
  );
}

export function EquipmentSection({ data }: SectionProps) {
  return (
    <Panel
      title="Equipamentos atribuídos"
      description="Consulta dos ativos vinculados aos colaboradores. Cadastro, atribuição e devolução são administrados exclusivamente em Patrimônio e Licenças."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Equipamento</th>
              <th className="px-4 py-2 text-left font-semibold">Patrimônio / Série</th>
              <th className="px-4 py-2 text-left font-semibold">Unidade</th>
              <th className="px-4 py-2 text-left font-semibold">Estado</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Atribuído a</th>
            </tr>
          </thead>
          <tbody>
            {data.equipment.length === 0 && (
              <EmptyRow colSpan={6} label="Nenhum equipamento vinculado." />
            )}
            {data.equipment.map((equipment) => {
              const assignment = data.assignments.find(
                (item) => item.equipment_id === equipment.id && item.status === "ATIVO",
              );
              return (
                <tr key={equipment.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{equipment.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[equipment.manufacturer, equipment.model, equipment.equipment_type]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="num px-4 py-3">
                    {equipment.asset_number ?? "—"} / {equipment.serial_number ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <UnitTag>{unitCode(data, equipment.business_unit_id)}</UnitTag>
                  </td>
                  <td className="px-4 py-3">{statusLabel(equipment.condition)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusLabel(equipment.status)} />
                  </td>
                  <td className="px-4 py-3">
                    {assignment ? employeeName(data, assignment.employee_id) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function AccessesSection({ data, onAction }: SectionProps) {
  return (
    <Panel
      title="Acessos externos"
      description="Registro de concessão e revogação. Senhas, tokens e chaves não são armazenados."
      actions={
        data.permissions.manageAccesses ? (
          <Button onClick={() => onAction({ kind: "create-access" })}>
            <Plus /> Registrar acesso
          </Button>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Colaborador</th>
              <th className="px-4 py-2 text-left font-semibold">Plataforma</th>
              <th className="px-4 py-2 text-left font-semibold">Conta</th>
              <th className="px-4 py-2 text-left font-semibold">Tipo</th>
              <th className="px-4 py-2 text-left font-semibold">Concedido</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.accesses.length === 0 && (
              <EmptyRow colSpan={7} label="Nenhum acesso registrado." />
            )}
            {data.accesses.map((access) => (
              <tr key={access.id} className="border-t">
                <td className="px-4 py-3 font-medium">{employeeName(data, access.employee_id)}</td>
                <td className="px-4 py-3">{access.platform}</td>
                <td className="px-4 py-3">{access.account_identifier ?? "—"}</td>
                <td className="px-4 py-3">{access.access_type ?? "—"}</td>
                <td className="num px-4 py-3">
                  {access.granted_at ? formatDate(access.granted_at) : "Pendente"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={statusLabel(access.status)} />
                </td>
                <td className="px-4 py-3 text-right">
                  {data.permissions.manageAccesses && access.status !== "REVOGADO" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onAction({ kind: "revoke-access", access })}
                    >
                      <ShieldOff /> Revogar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function SettingsSection({ data, onAction }: SectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel
        title="Cargos"
        description="Catálogo somente para consulta. Cargos são mantidos exclusivamente em Estrutura Organizacional."
      >
        <div className="divide-y">
          {data.positions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>
          ) : (
            data.positions.map((position) => (
              <div key={position.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{position.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {position.code} · {unitCode(data, position.businessUnitId ?? null)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel
        title="Alertas"
        description="Antecedência de vencimento de contratos e documentos por unidade ou global."
        actions={
          data.permissions.manageSettings ? (
            <Button onClick={() => onAction({ kind: "upsert-settings" })}>
              Configurar alertas
            </Button>
          ) : null
        }
      >
        <div className="divide-y">
          {data.settings.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Configuração padrão: 30 dias.</p>
          ) : (
            data.settings.map((setting) => (
              <div key={setting.id} className="grid gap-3 p-4 sm:grid-cols-3">
                <div>
                  <p className="label-caps">Escopo</p>
                  <p className="mt-1 text-sm font-medium">
                    {unitCode(data, setting.business_unit_id)}
                  </p>
                </div>
                <div>
                  <p className="label-caps">Contratos</p>
                  <p className="num mt-1 text-sm font-medium">
                    {setting.contract_expiry_alert_days} dias
                  </p>
                </div>
                <div>
                  <p className="label-caps">Documentos</p>
                  <p className="num mt-1 text-sm font-medium">
                    {setting.document_expiry_alert_days} dias
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function ProcessCards({
  data,
  kind,
  tasks,
  onAction,
}: {
  data: HrDirectory;
  kind: "onboarding" | "offboarding";
  tasks: ProcessTask[];
  onAction: (action: HrActionState) => void;
}) {
  const processes = kind === "onboarding" ? data.onboardings : data.offboardings;
  if (processes.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      {processes.map((process) => {
        const processTasks = tasks.filter((task) =>
          kind === "onboarding"
            ? task.onboarding_process_id === process.id
            : task.offboarding_process_id === process.id,
        );
        const isOnboarding = kind === "onboarding";
        const canManage = isOnboarding
          ? data.permissions.manageOnboarding
          : data.permissions.manageOffboarding;
        const date = isOnboarding
          ? data.onboardings.find((item) => item.id === process.id)?.expected_start_date
          : data.offboardings.find((item) => item.id === process.id)?.last_working_day;

        return (
          <div key={process.id} className="rounded-sm border bg-background">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <p className="font-medium">{employeeName(data, process.employee_id)}</p>
                <p className="num mt-1 text-xs text-muted-foreground">
                  {isOnboarding ? "Início previsto" : "Último dia"}: {date ? formatDate(date) : "—"}
                </p>
              </div>
              <StatusPill status={statusLabel(process.status)} />
            </div>
            {isOnboarding ? (
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="num font-medium">
                    {Math.round(
                      data.onboardings.find((item) => item.id === process.id)
                        ?.completion_percentage ?? 0,
                    )}
                    %
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, data.onboardings.find((item) => item.id === process.id)?.completion_percentage ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div className="divide-y">
              {processTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.required ? "Obrigatória" : "Opcional"}
                      {task.due_date ? ` · até ${formatDate(task.due_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={statusLabel(task.status)} />
                    {canManage && task.status !== "CONCLUIDA" && task.status !== "CANCELADA" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onAction(
                            kind === "onboarding"
                              ? { kind: "update-onboarding-task", task, status: "CONCLUIDA" }
                              : { kind: "update-offboarding-task", task, status: "CONCLUIDA" },
                          )
                        }
                      >
                        <Check /> Concluir
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {!isOnboarding &&
            data.permissions.manageOffboarding &&
            process.status !== "CONCLUIDO" ? (
              <div className="border-t p-3 text-right">
                <Button
                  variant="destructive"
                  onClick={() =>
                    onAction({
                      kind: "complete-offboarding",
                      process: data.offboardings.find((item) => item.id === process.id)!,
                    })
                  }
                >
                  Concluir desligamento
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function employeeName(data: HrDirectory, employeeId: string) {
  return (
    data.employees.find((employee) => employee.employee_id === employeeId)?.display_name ??
    employeeId
  );
}

function optionName(options: HrOption[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.id === id)?.name ?? id;
}

function unitCode(data: HrDirectory, unitId: string | null | undefined) {
  if (!unitId) return "GLOBAL";
  return data.businessUnits.find((unit) => unit.id === unitId)?.code ?? unitId;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(value),
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function workModeLabel(value: EmployeeDirectoryRow["work_mode"]) {
  return { PRESENCIAL: "Presencial", HIBRIDO: "Híbrido", REMOTO: "Remoto" }[value];
}

function visibilityLabel(value: string) {
  return (
    {
      RH_ONLY: "Somente RH",
      EMPLOYEE_AND_RH: "Colaborador e RH",
      MANAGER_AND_RH: "Gestor e RH",
      FINANCE_AND_RH: "Financeiro e RH",
    }[value] ?? value
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    ATIVO: "ativo",
    AFASTADO: "afastado",
    DESLIGADO: "desligado",
    RASCUNHO: "rascunho",
    SOLICITADO: "solicitado",
    APROVADO: "aprovado",
    RECUSADO: "recusado",
    CANCELADO: "cancelado",
    CONCLUIDO: "concluído",
    CONCLUIDA: "concluída",
    PENDENTE: "pendente",
    EM_ANDAMENTO: "em andamento",
    PAGO: "pago",
    AGENDADO: "agendado",
    ATRASADO: "atrasado",
    DISPONIVEL: "disponível",
    ATRIBUIDO: "atribuído",
    EM_MANUTENCAO: "em manutenção",
    DEVOLVIDO: "devolvido",
    BAIXADO: "baixado",
    REVOGADO: "revogado",
    NOVO: "novo",
    BOM: "bom",
    REGULAR: "regular",
    DANIFICADO: "danificado",
    active: "ativo",
    inactive: "inativo",
  };
  return labels[value] ?? value.toLowerCase().replaceAll("_", " ");
}
