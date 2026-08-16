import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
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
import { Textarea } from "@/shared/components/ui/textarea";
import {
  completeOffboarding,
  createAccess,
  createContract,
  createEmployee,
  createLeave,
  createOffboarding,
  createOnboarding,
  createPayment,
  decideLeave,
  getEmployeeSensitiveDetail,
  markPaymentPaid,
  revokeAccess,
  updateOffboardingTask,
  updateOnboardingTask,
  uploadEmployeeDocument,
  upsertHrSettings,
} from "./api";
import type {
  EmployeeAccess,
  EmployeePayment,
  HrDirectory,
  HrSetting,
  LeaveRequest,
  OffboardingProcess,
  ProcessTask,
} from "./types";

export type HrActionState =
  | { kind: "create-employee" }
  | { kind: "view-employee"; employeeId: string }
  | { kind: "create-contract"; employeeId?: string }
  | { kind: "upload-document"; employeeId?: string }
  | { kind: "create-leave"; employeeId?: string }
  | { kind: "decide-leave"; request: LeaveRequest; decision: "APROVADO" | "RECUSADO" }
  | { kind: "create-payment"; employeeId?: string }
  | { kind: "mark-payment-paid"; payment: EmployeePayment }
  | { kind: "create-onboarding"; employeeId?: string }
  | { kind: "update-onboarding-task"; task: ProcessTask; status: "CONCLUIDA" }
  | { kind: "create-offboarding"; employeeId?: string }
  | { kind: "update-offboarding-task"; task: ProcessTask; status: "CONCLUIDA" }
  | { kind: "complete-offboarding"; process: OffboardingProcess }
  | { kind: "create-access"; employeeId?: string }
  | { kind: "revoke-access"; access: EmployeeAccess }
  | { kind: "upsert-settings"; setting?: HrSetting }
  | null;

interface Props {
  action: HrActionState;
  data: HrDirectory;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

const selectClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

export function HrActionDialog({ action, data, onOpenChange, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [settingsUnitId, setSettingsUnitId] = useState("");
  const employeeId = action?.kind === "view-employee" ? action.employeeId : null;
  const detailQuery = useQuery({
    queryKey: ["hr-employee-sensitive", employeeId],
    queryFn: () => getEmployeeSensitiveDetail(employeeId!),
    enabled: Boolean(employeeId),
  });

  useEffect(() => {
    if (action?.kind === "upsert-settings") {
      // Synchronize the editor selection whenever a different settings action is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsUnitId(action.setting?.business_unit_id ?? "");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsUnitId("");
    }
  }, [action]);

  if (!action) return null;

  const title = actionTitle(action);
  const description = actionDescription(action);
  const currentSetting = data.settings.find(
    (setting) => (setting.business_unit_id ?? "") === settingsUnitId,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      switch (action.kind) {
        case "create-employee":
          await createEmployee({
            legalName: required(form, "legalName"),
            socialName: optional(form, "socialName"),
            cpf: required(form, "cpf"),
            birthDate: required(form, "birthDate"),
            personalEmail: optional(form, "personalEmail"),
            phone: optional(form, "phone"),
            addressLine: optional(form, "addressLine"),
            city: optional(form, "city"),
            state: optional(form, "state"),
            postalCode: optional(form, "postalCode"),
            emergencyContactName: optional(form, "emergencyContactName"),
            emergencyContactPhone: optional(form, "emergencyContactPhone"),
            photoPath: null,
            userId: optional(form, "userId"),
            corporateEmail: optional(form, "corporateEmail"),
            businessUnitId: required(form, "businessUnitId"),
            departmentId: optional(form, "departmentId"),
            positionId: optional(form, "positionId"),
            managerEmployeeId: optional(form, "managerEmployeeId"),
            hireDate: required(form, "hireDate"),
            employmentType: required(form, "employmentType"),
            workSchedule: optional(form, "workSchedule"),
            workMode: required(form, "workMode"),
            status: required(form, "status"),
            internalNotes: optional(form, "internalNotes"),
          });
          break;
        case "create-contract":
          await createContract({
            employeeId: required(form, "employeeId"),
            legalEntityId: required(form, "legalEntityId"),
            positionId: optional(form, "positionId"),
            contractType: required(form, "contractType"),
            startDate: required(form, "startDate"),
            endDate: optional(form, "endDate"),
            amount: optionalNumber(form, "amount"),
            paymentFrequency: optional(form, "paymentFrequency"),
            paymentMethod: optional(form, "paymentMethod"),
            workSchedule: optional(form, "workSchedule"),
            workMode: required(form, "workMode"),
            status: required(form, "status"),
            filePath: null,
            notes: optional(form, "notes"),
            isPrimary: true,
          });
          break;
        case "upload-document": {
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
          await uploadEmployeeDocument({
            employeeId: required(form, "employeeId"),
            documentTypeId: required(form, "documentTypeId"),
            name: required(form, "name"),
            visibility: required(form, "visibility"),
            issuedAt: optional(form, "issuedAt") ?? undefined,
            expiresAt: optional(form, "expiresAt") ?? undefined,
            notes: optional(form, "notes") ?? undefined,
            file,
          });
          break;
        }
        case "create-leave":
          await createLeave({
            employeeId: required(form, "employeeId"),
            leaveTypeId: required(form, "leaveTypeId"),
            startDate: required(form, "startDate"),
            endDate: required(form, "endDate"),
            reason: optional(form, "reason"),
            managerEmployeeId: optional(form, "managerEmployeeId"),
            notes: optional(form, "notes"),
            submit: true,
          });
          break;
        case "decide-leave":
          await decideLeave({
            requestId: action.request.id,
            decision: action.decision,
            rejectionReason: optional(form, "rejectionReason") ?? undefined,
            expectedVersion: action.request.version,
          });
          break;
        case "create-payment":
          await createPayment({
            employeeId: required(form, "employeeId"),
            contractId: optional(form, "contractId"),
            competence: `${required(form, "competence")}-01`,
            description: required(form, "description"),
            baseAmount: requiredNumber(form, "baseAmount"),
            additions: optionalNumber(form, "additions") ?? 0,
            informationalDeductions: optionalNumber(form, "deductions") ?? 0,
            expectedDate: required(form, "expectedDate"),
            paymentMethod: optional(form, "paymentMethod"),
            status: required(form, "status"),
            notes: optional(form, "notes"),
          });
          break;
        case "mark-payment-paid":
          await markPaymentPaid({
            paymentId: action.payment.id,
            paymentDate: required(form, "paymentDate"),
            paymentMethod: optional(form, "paymentMethod"),
            proofStoragePath: null,
            expectedVersion: action.payment.version,
          });
          break;
        case "create-onboarding":
          await createOnboarding({
            employeeId: required(form, "employeeId"),
            expectedStartDate: required(form, "expectedStartDate"),
            responsibleUserId: optional(form, "responsibleUserId"),
            notes: optional(form, "notes"),
          });
          break;
        case "update-onboarding-task":
          await updateOnboardingTask({
            taskId: action.task.id,
            status: action.status,
            responsibleUserId: action.task.responsible_user_id,
            dueDate: action.task.due_date,
            notes: optional(form, "notes") ?? action.task.notes,
            expectedVersion: action.task.version,
          });
          break;
        case "create-offboarding":
          await createOffboarding({
            employeeId: required(form, "employeeId"),
            lastWorkingDay: required(form, "lastWorkingDay"),
            reason: required(form, "reason"),
            responsibleUserId: optional(form, "responsibleUserId"),
            notes: optional(form, "notes"),
          });
          break;
        case "update-offboarding-task":
          await updateOffboardingTask({
            taskId: action.task.id,
            status: action.status,
            responsibleUserId: action.task.responsible_user_id,
            dueDate: action.task.due_date,
            notes: optional(form, "notes") ?? action.task.notes,
            expectedVersion: action.task.version,
          });
          break;
        case "complete-offboarding":
          await completeOffboarding({
            processId: action.process.id,
            effectiveDate: required(form, "effectiveDate"),
            expectedVersion: action.process.version,
          });
          break;
        case "create-access":
          await createAccess({
            employeeId: required(form, "employeeId"),
            platform: required(form, "platform"),
            accountIdentifier: optional(form, "accountIdentifier"),
            accessType: optional(form, "accessType"),
            grantedAt: optional(form, "grantedAt"),
            status: required(form, "status"),
            notes: optional(form, "notes"),
          });
          break;
        case "revoke-access":
          await revokeAccess({
            accessId: action.access.id,
            revokedAt: required(form, "revokedAt"),
            notes: optional(form, "notes"),
            expectedVersion: action.access.version,
          });
          break;
        case "upsert-settings":
          await upsertHrSettings({
            businessUnitId: optional(form, "businessUnitId"),
            contractExpiryAlertDays: requiredNumber(form, "contractDays"),
            documentExpiryAlertDays: requiredNumber(form, "documentDays"),
            expectedVersion: currentSetting?.version,
          });
          break;
        case "view-employee":
          return;
      }

      await onSuccess();
      toast.success(successMessage(action.kind));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar a operação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {action.kind === "view-employee" ? (
          <EmployeeDetailContent query={detailQuery} data={data} />
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <ActionFields
              action={action}
              data={data}
              settingsUnitId={settingsUnitId}
              setSettingsUnitId={setSettingsUnitId}
              currentSetting={currentSetting}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                variant={destructiveAction(action) ? "destructive" : "default"}
              >
                {submitting ? "Processando…" : submitLabel(action)}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionFields({
  action,
  data,
  settingsUnitId,
  setSettingsUnitId,
  currentSetting,
}: {
  action: Exclude<HrActionState, null | { kind: "view-employee" }>;
  data: HrDirectory;
  settingsUnitId: string;
  setSettingsUnitId: (value: string) => void;
  currentSetting?: HrSetting;
}) {
  switch (action.kind) {
    case "create-employee":
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nome completo">
            <Input name="legalName" required />
          </Field>
          <Field label="Nome social">
            <Input name="socialName" />
          </Field>
          <Field label="CPF">
            <Input name="cpf" inputMode="numeric" maxLength={14} required />
          </Field>
          <Field label="Data de nascimento">
            <Input name="birthDate" type="date" required />
          </Field>
          <Field label="E-mail pessoal">
            <Input name="personalEmail" type="email" />
          </Field>
          <Field label="Telefone">
            <Input name="phone" />
          </Field>
          <Field label="Endereço" className="md:col-span-2">
            <Input name="addressLine" />
          </Field>
          <Field label="Cidade">
            <Input name="city" />
          </Field>
          <Field label="UF">
            <Input name="state" maxLength={2} />
          </Field>
          <Field label="CEP">
            <Input name="postalCode" inputMode="numeric" />
          </Field>
          <Field label="Contato de emergência">
            <Input name="emergencyContactName" />
          </Field>
          <Field label="Telefone de emergência">
            <Input name="emergencyContactPhone" />
          </Field>
          <Field label="E-mail corporativo">
            <Input name="corporateEmail" type="email" />
          </Field>
          <Field label="Usuário do sistema">
            <OptionSelect name="userId" options={data.users} empty="Sem conta vinculada" />
          </Field>
          <Field label="Unidade de negócio">
            <OptionSelect name="businessUnitId" options={data.businessUnits} required />
          </Field>
          <Field label="Departamento">
            <OptionSelect name="departmentId" options={data.departments} empty="Não definido" />
          </Field>
          <Field label="Cargo">
            <OptionSelect name="positionId" options={data.positions} empty="Não definido" />
          </Field>
          <Field label="Gestor">
            <EmployeeSelect name="managerEmployeeId" data={data} empty="Não definido" />
          </Field>
          <Field label="Data de entrada">
            <Input name="hireDate" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Tipo de contratação">
            <Select name="employmentType" required options={employmentTypeOptions} />
          </Field>
          <Field label="Modalidade">
            <Select name="workMode" required options={workModeOptions} />
          </Field>
          <Field label="Jornada">
            <Input name="workSchedule" placeholder="Ex.: 40h semanais" />
          </Field>
          <Field label="Status">
            <Select name="status" required options={employeeStatusOptions} />
          </Field>
          <Field label="Observações internas" className="md:col-span-2 xl:col-span-3">
            <Textarea name="internalNotes" rows={3} />
          </Field>
        </div>
      );
    case "create-contract":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Empresa contratante">
            <OptionSelect name="legalEntityId" options={data.legalEntities} required />
          </Field>
          <Field label="Cargo">
            <OptionSelect name="positionId" options={data.positions} empty="Usar cargo atual" />
          </Field>
          <Field label="Tipo">
            <Select name="contractType" options={employmentTypeOptions} required />
          </Field>
          <Field label="Data inicial">
            <Input name="startDate" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Data final">
            <Input name="endDate" type="date" />
          </Field>
          <Field label="Valor">
            <Input name="amount" type="number" min="0" step="0.01" />
          </Field>
          <Field label="Frequência">
            <Select
              name="paymentFrequency"
              options={paymentFrequencyOptions}
              empty="Não informada"
            />
          </Field>
          <Field label="Forma de pagamento">
            <Input name="paymentMethod" />
          </Field>
          <Field label="Modalidade">
            <Select name="workMode" options={workModeOptions} required />
          </Field>
          <Field label="Jornada">
            <Input name="workSchedule" />
          </Field>
          <Field label="Status">
            <Select name="status" options={contractStatusOptions} required />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "upload-document":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Tipo">
            <OptionSelect name="documentTypeId" options={data.documentTypes} required />
          </Field>
          <Field label="Nome do documento">
            <Input name="name" required />
          </Field>
          <Field label="Visibilidade">
            <Select name="visibility" options={visibilityOptions} required />
          </Field>
          <Field label="Emissão">
            <Input name="issuedAt" type="date" />
          </Field>
          <Field label="Validade">
            <Input name="expiresAt" type="date" />
          </Field>
          <Field label="Arquivo" className="md:col-span-2">
            <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" required />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "create-leave":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Tipo">
            <OptionSelect name="leaveTypeId" options={data.leaveTypes} required />
          </Field>
          <Field label="Data inicial">
            <Input name="startDate" type="date" required />
          </Field>
          <Field label="Data final">
            <Input name="endDate" type="date" required />
          </Field>
          <Field label="Gestor">
            <EmployeeSelect name="managerEmployeeId" data={data} empty="Usar gestor do cadastro" />
          </Field>
          <Field label="Motivo">
            <Input name="reason" />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "decide-leave":
      return action.decision === "RECUSADO" ? (
        <Field label="Motivo da recusa">
          <Textarea name="rejectionReason" rows={4} required />
        </Field>
      ) : (
        <p className="rounded-sm border bg-muted/40 p-4 text-sm">
          Confirme a aprovação da solicitação de {employeeName(data, action.request.employee_id)}.
        </p>
      );
    case "create-payment":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Contrato">
            <OptionSelect
              name="contractId"
              options={data.contracts.map((contract) => ({
                id: contract.id,
                name: `${employeeName(data, contract.employee_id)} · ${contract.contract_type}`,
              }))}
              empty="Sem contrato associado"
            />
          </Field>
          <Field label="Competência">
            <Input name="competence" type="month" required />
          </Field>
          <Field label="Data prevista">
            <Input name="expectedDate" type="date" required />
          </Field>
          <Field label="Descrição" className="md:col-span-2">
            <Input name="description" required />
          </Field>
          <Field label="Valor base">
            <Input name="baseAmount" type="number" min="0" step="0.01" required />
          </Field>
          <Field label="Adicionais">
            <Input name="additions" type="number" min="0" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Descontos informativos">
            <Input name="deductions" type="number" min="0" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Forma de pagamento">
            <Input name="paymentMethod" />
          </Field>
          <Field label="Status">
            <Select name="status" options={paymentStatusOptions} required />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "mark-payment-paid":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Data de pagamento">
            <Input name="paymentDate" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Forma de pagamento">
            <Input name="paymentMethod" defaultValue={action.payment.payment_method ?? ""} />
          </Field>
        </div>
      );
    case "create-onboarding":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Início previsto">
            <Input name="expectedStartDate" type="date" required />
          </Field>
          <Field label="Responsável">
            <OptionSelect name="responsibleUserId" options={data.users} empty="Usuário atual" />
          </Field>
          <Field label="Observações">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "update-onboarding-task":
    case "update-offboarding-task":
      return (
        <div className="space-y-4">
          <p className="rounded-sm border bg-muted/40 p-4 text-sm">
            A tarefa <strong>{action.task.title}</strong> será marcada como concluída.
          </p>
          <Field label="Observação de conclusão">
            <Textarea name="notes" rows={3} defaultValue={action.task.notes ?? ""} />
          </Field>
        </div>
      );
    case "create-offboarding":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Último dia de trabalho">
            <Input name="lastWorkingDay" type="date" required />
          </Field>
          <Field label="Responsável">
            <OptionSelect name="responsibleUserId" options={data.users} empty="Usuário atual" />
          </Field>
          <Field label="Motivo">
            <Input name="reason" required />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "complete-offboarding":
      return (
        <div className="space-y-4">
          <p className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
            A conclusão encerrará contratos ativos, revogará acessos registrados, marcará o
            colaborador como desligado e inativará a conta vinculada. Tarefas obrigatórias e
            equipamentos pendentes bloqueiam a operação.
          </p>
          <Field label="Data efetiva do desligamento">
            <Input
              name="effectiveDate"
              type="date"
              defaultValue={action.process.last_working_day}
              required
            />
          </Field>
        </div>
      );
    case "create-access":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Colaborador">
            <EmployeeSelect
              name="employeeId"
              data={data}
              defaultValue={action.employeeId}
              required
            />
          </Field>
          <Field label="Plataforma">
            <Input name="platform" required />
          </Field>
          <Field label="Identificador da conta">
            <Input name="accountIdentifier" placeholder="E-mail ou usuário, nunca senha" />
          </Field>
          <Field label="Tipo de acesso">
            <Input name="accessType" />
          </Field>
          <Field label="Status">
            <Select name="status" options={accessStatusOptions} required />
          </Field>
          <Field label="Data de concessão">
            <Input name="grantedAt" type="date" defaultValue={today()} />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "revoke-access":
      return (
        <div className="space-y-4">
          <p className="rounded-sm border bg-muted/40 p-4 text-sm">
            Revogar acesso de {employeeName(data, action.access.employee_id)} em{" "}
            <strong>{action.access.platform}</strong>.
          </p>
          <Field label="Data de revogação">
            <Input name="revokedAt" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Observações">
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
      );
    case "upsert-settings":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Escopo" className="md:col-span-2">
            <select
              name="businessUnitId"
              className={selectClass}
              value={settingsUnitId}
              onChange={(event) => setSettingsUnitId(event.target.value)}
            >
              <option value="">Configuração global</option>
              {data.businessUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Avisar contratos com antecedência">
            <Input
              name="contractDays"
              type="number"
              min="1"
              max="365"
              defaultValue={currentSetting?.contract_expiry_alert_days ?? 30}
              required
              key={`contract-${settingsUnitId}`}
            />
          </Field>
          <Field label="Avisar documentos com antecedência">
            <Input
              name="documentDays"
              type="number"
              min="1"
              max="365"
              defaultValue={currentSetting?.document_expiry_alert_days ?? 30}
              required
              key={`document-${settingsUnitId}`}
            />
          </Field>
        </div>
      );
  }
}

function EmployeeDetailContent({
  query,
  data,
}: {
  query: ReturnType<typeof useQuery<EmployeeSensitiveDetailResult>>;
  data: HrDirectory;
}) {
  if (query.isLoading)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" /> Carregando ficha protegida…
      </p>
    );
  if (query.isError || !query.data)
    return (
      <p className="text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "Ficha não disponível."}
      </p>
    );
  const detail = query.data;
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
      <Detail label="Nome legal" value={detail.legalName} />
      <Detail label="Nome social" value={detail.socialName ?? "—"} />
      <Detail label="CPF" value={formatCpf(detail.cpf)} />
      <Detail label="Nascimento" value={formatDate(detail.birthDate)} />
      <Detail label="E-mail pessoal" value={detail.personalEmail ?? "—"} />
      <Detail label="Telefone" value={detail.phone ?? "—"} />
      <Detail
        label="Endereço"
        value={
          [detail.addressLine, detail.city, detail.state, detail.postalCode]
            .filter(Boolean)
            .join(" · ") || "—"
        }
        className="md:col-span-2"
      />
      <Detail
        label="Emergência"
        value={
          [detail.emergencyContactName, detail.emergencyContactPhone].filter(Boolean).join(" · ") ||
          "—"
        }
      />
      <Detail label="E-mail corporativo" value={detail.corporateEmail ?? "—"} />
      <Detail label="Unidade" value={optionName(data.businessUnits, detail.businessUnitId)} />
      <Detail label="Departamento" value={optionName(data.departments, detail.departmentId)} />
      <Detail label="Cargo" value={optionName(data.positions, detail.positionId)} />
      <Detail
        label="Gestor"
        value={detail.managerEmployeeId ? employeeName(data, detail.managerEmployeeId) : "—"}
      />
      <Detail label="Entrada" value={formatDate(detail.hireDate)} />
      <Detail label="Vínculo" value={detail.employmentType} />
      <Detail label="Modalidade" value={detail.workMode} />
      <Detail label="Status" value={detail.status} />
      <Detail label="Jornada" value={detail.workSchedule ?? "—"} />
      <Detail
        label="Observações internas"
        value={detail.internalNotes ?? "—"}
        className="md:col-span-2 xl:col-span-3"
      />
    </div>
  );
}

type EmployeeSensitiveDetailResult = Awaited<ReturnType<typeof getEmployeeSensitiveDetail>>;

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="label-caps">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</p>
    </div>
  );
}

function Select({
  name,
  options,
  required,
  empty,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  empty?: string;
}) {
  return (
    <select name={name} className={selectClass} required={required}>
      {empty ? <option value="">{empty}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function OptionSelect({
  name,
  options,
  required,
  empty,
  defaultValue,
}: {
  name: string;
  options: Array<{ id: string; name: string }>;
  required?: boolean;
  empty?: string;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      className={selectClass}
      required={required}
      defaultValue={defaultValue ?? ""}
    >
      {empty || !defaultValue ? <option value="">{empty ?? "Selecione"}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function EmployeeSelect({
  name,
  data,
  required,
  empty,
  defaultValue,
}: {
  name: string;
  data: HrDirectory;
  required?: boolean;
  empty?: string;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      className={selectClass}
      required={required}
      defaultValue={defaultValue ?? ""}
    >
      {empty || !defaultValue ? <option value="">{empty ?? "Selecione"}</option> : null}
      {data.employees
        .filter((employee) => employee.status !== "DESLIGADO")
        .map((employee) => (
          <option key={employee.employee_id} value={employee.employee_id}>
            {employee.display_name} · {employee.unit_code}
          </option>
        ))}
    </select>
  );
}

function required(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`Campo obrigatório: ${name}.`);
  return value.trim();
}
function optional(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredNumber(form: FormData, name: string) {
  const value = Number(required(form, name));
  if (!Number.isFinite(value)) throw new Error(`Número inválido: ${name}.`);
  return value;
}
function optionalNumber(form: FormData, name: string) {
  const value = optional(form, name);
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Número inválido: ${name}.`);
  return number;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}
function formatCpf(value: string) {
  return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
function employeeName(data: HrDirectory, id: string) {
  return data.employees.find((employee) => employee.employee_id === id)?.display_name ?? id;
}
function optionName(options: Array<{ id: string; name: string }>, id: string | null) {
  return id ? (options.find((option) => option.id === id)?.name ?? id) : "—";
}

function actionTitle(action: Exclude<HrActionState, null>) {
  const titles: Record<Exclude<HrActionState, null>["kind"], string> = {
    "create-employee": "Novo colaborador",
    "view-employee": "Ficha do colaborador",
    "create-contract": "Novo contrato",
    "upload-document": "Enviar documento",
    "create-leave": "Nova solicitação",
    "decide-leave": "Decidir solicitação",
    "create-payment": "Novo pagamento",
    "mark-payment-paid": "Confirmar pagamento",
    "create-onboarding": "Iniciar onboarding",
    "update-onboarding-task": "Concluir tarefa de onboarding",
    "create-offboarding": "Iniciar desligamento",
    "update-offboarding-task": "Concluir tarefa de desligamento",
    "complete-offboarding": "Concluir desligamento",
    "create-access": "Registrar acesso",
    "revoke-access": "Revogar acesso",
    "upsert-settings": "Configurar alertas",
  };
  return titles[action.kind];
}

function actionDescription(action: Exclude<HrActionState, null>) {
  if (action.kind === "view-employee")
    return "Dados pessoais protegidos por permissão específica e auditoria.";
  if (action.kind === "complete-offboarding")
    return "Operação crítica executada de forma transacional no servidor.";
  return "A operação será validada no servidor, respeitando escopo por unidade, MFA e controle de concorrência.";
}

function submitLabel(action: Exclude<HrActionState, null | { kind: "view-employee" }>) {
  if (
    [
      "decide-leave",
      "update-onboarding-task",
      "update-offboarding-task",
      "mark-payment-paid",
    ].includes(action.kind)
  )
    return "Confirmar";
  if (["complete-offboarding", "revoke-access"].includes(action.kind)) return "Executar operação";
  return "Salvar";
}

function destructiveAction(action: Exclude<HrActionState, null | { kind: "view-employee" }>) {
  return (
    action.kind === "complete-offboarding" ||
    action.kind === "revoke-access" ||
    (action.kind === "decide-leave" && action.decision === "RECUSADO")
  );
}

function successMessage(kind: Exclude<HrActionState, null>["kind"]) {
  return {
    "create-employee": "Colaborador cadastrado.",
    "view-employee": "",
    "create-contract": "Contrato cadastrado.",
    "upload-document": "Documento enviado.",
    "create-leave": "Solicitação registrada.",
    "decide-leave": "Decisão registrada.",
    "create-payment": "Pagamento cadastrado.",
    "mark-payment-paid": "Pagamento confirmado.",
    "create-onboarding": "Onboarding iniciado.",
    "update-onboarding-task": "Tarefa concluída.",
    "create-offboarding": "Desligamento iniciado.",
    "update-offboarding-task": "Tarefa concluída.",
    "complete-offboarding": "Desligamento concluído.",
    "create-access": "Acesso registrado.",
    "revoke-access": "Acesso revogado.",
    "upsert-settings": "Configuração atualizada.",
  }[kind];
}

const employmentTypeOptions = ["CLT", "PJ", "FREELANCER", "ESTAGIO", "SOCIO", "OUTRO"].map(
  (value) => ({
    value,
    label: value === "ESTAGIO" ? "Estágio" : value === "SOCIO" ? "Sócio" : value,
  }),
);
const workModeOptions = [
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "HIBRIDO", label: "Híbrido" },
  { value: "REMOTO", label: "Remoto" },
];
const employeeStatusOptions = [
  { value: "ATIVO", label: "Ativo" },
  { value: "AFASTADO", label: "Afastado" },
  { value: "DESLIGADO", label: "Desligado" },
];
const contractStatusOptions = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "ATIVO", label: "Ativo" },
  { value: "ENCERRADO", label: "Encerrado" },
  { value: "CANCELADO", label: "Cancelado" },
];
const paymentFrequencyOptions = [
  "MENSAL",
  "QUINZENAL",
  "SEMANAL",
  "POR_PROJETO",
  "POR_HORA",
  "OUTRO",
].map((value) => ({ value, label: value.replaceAll("_", " ") }));
const paymentStatusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "AGENDADO", label: "Agendado" },
];
const visibilityOptions = [
  { value: "RH_ONLY", label: "Somente RH" },
  { value: "EMPLOYEE_AND_RH", label: "Colaborador e RH" },
  { value: "MANAGER_AND_RH", label: "Gestor e RH" },
  { value: "FINANCE_AND_RH", label: "Financeiro e RH" },
];
const accessStatusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "ATIVO", label: "Ativo" },
];
