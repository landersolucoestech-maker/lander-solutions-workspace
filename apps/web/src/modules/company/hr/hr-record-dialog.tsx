import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { downloadEmployeeDocument, getEmployeeSensitiveDetail } from "./api";
import {
  deleteHrRecord,
  updateHrDocumentRecord,
  updateHrEmployeeRecord,
  updateHrLeaveRecord,
  updateHrPaymentRecord,
} from "./record-api";
import type {
  EmployeeDirectoryRow,
  EmployeeDocument,
  EmployeePayment,
  EmployeeSensitiveDetail,
  HrDirectory,
  LeaveRequest,
} from "./types";

export type HrRecordActionState =
  | {
      entity: "employee";
      action: "view" | "edit" | "delete";
      record: EmployeeDirectoryRow;
    }
  | {
      entity: "payment";
      action: "view" | "edit" | "delete";
      record: EmployeePayment;
    }
  | {
      entity: "leave";
      action: "view" | "edit" | "delete";
      record: LeaveRequest;
    }
  | {
      entity: "document";
      action: "view" | "edit" | "delete";
      record: EmployeeDocument;
    }
  | null;

interface Props {
  state: HrRecordActionState;
  data: HrDirectory;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const selectClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

export function HrRecordDialog({ state, data, onClose, onChanged }: Props) {
  const employeeId = state?.entity === "employee" ? state.record.employee_id : null;
  const detailQuery = useQuery({
    queryKey: ["hr-employee-sensitive", employeeId],
    queryFn: () => getEmployeeSensitiveDetail(employeeId!),
    enabled: Boolean(employeeId && state?.action !== "delete"),
  });
  const [submitting, setSubmitting] = useState(false);

  if (!state) return null;
  const activeState = state;

  if (activeState.action === "delete") {
    return (
      <DeleteDialog
        state={activeState}
        data={data}
        submitting={submitting}
        onClose={onClose}
        onDelete={async () => {
          setSubmitting(true);
          try {
            await deleteHrRecord(
              activeState.entity,
              recordId(activeState),
              recordVersion(activeState),
            );
            await onChanged();
            toast.success("Registro excluído com histórico preservado.");
            onClose();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao excluir o registro.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  if (activeState.entity === "employee" && detailQuery.isLoading) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando ficha do colaborador…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeState.entity === "employee" && (detailQuery.isError || !detailQuery.data)) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falha ao carregar colaborador</DialogTitle>
            <DialogDescription>
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "A ficha do colaborador não está disponível."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              Tentar novamente
            </Button>
            <DialogClose asChild>
              <Button>Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeState.action === "view") {
    return (
      <ViewDialog
        state={activeState}
        data={data}
        employeeDetail={detailQuery.data ?? null}
        onClose={onClose}
      />
    );
  }

  const employeeDetail = detailQuery.data ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      if (activeState.entity === "employee") {
        if (!employeeDetail) throw new Error("Ficha do colaborador não carregada.");
        await updateHrEmployeeRecord({
          employeeId: employeeDetail.employeeId,
          employeeExpectedVersion: employeeDetail.employeeVersion,
          personExpectedVersion: employeeDetail.personVersion,
          legalName: required(form, "legalName"),
          socialName: optional(form, "socialName"),
          birthDate: required(form, "birthDate"),
          personalEmail: optional(form, "personalEmail"),
          phone: optional(form, "phone"),
          addressLine: employeeDetail.addressLine ?? "",
          city: employeeDetail.city ?? "",
          state: employeeDetail.state ?? "",
          postalCode: employeeDetail.postalCode ?? "",
          emergencyContactName: employeeDetail.emergencyContactName ?? "",
          emergencyContactPhone: employeeDetail.emergencyContactPhone ?? "",
          photoPath: employeeDetail.photoPath ?? "",
          userId: employeeDetail.userId ?? "",
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
      } else if (activeState.entity === "payment") {
        await updateHrPaymentRecord({
          id: activeState.record.id,
          expectedVersion: activeState.record.version,
          employeeId: required(form, "employeeId"),
          contractId: optional(form, "contractId"),
          competence: `${required(form, "competence")}-01`,
          description: required(form, "description"),
          baseAmount: required(form, "baseAmount"),
          additions: required(form, "additions"),
          informationalDeductions: required(form, "deductions"),
          expectedDate: required(form, "expectedDate"),
          paymentDate: optional(form, "paymentDate"),
          paymentMethod: optional(form, "paymentMethod"),
          status: required(form, "status"),
          notes: optional(form, "notes"),
        });
      } else if (activeState.entity === "leave") {
        await updateHrLeaveRecord({
          id: activeState.record.id,
          expectedVersion: activeState.record.version,
          leaveTypeId: required(form, "leaveTypeId"),
          startDate: required(form, "startDate"),
          endDate: required(form, "endDate"),
          reason: optional(form, "reason"),
          managerEmployeeId: optional(form, "managerEmployeeId"),
          status: required(form, "status"),
          notes: optional(form, "notes"),
        });
      } else {
        await updateHrDocumentRecord({
          id: activeState.record.id,
          expectedVersion: activeState.record.version,
          documentTypeId: required(form, "documentTypeId"),
          name: required(form, "name"),
          issuedAt: optional(form, "issuedAt"),
          expiresAt: optional(form, "expiresAt"),
          visibility: required(form, "visibility"),
          status: required(form, "status"),
          notes: optional(form, "notes"),
        });
      }

      await onChanged();
      toast.success("Registro atualizado.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o registro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle(activeState)}</DialogTitle>
          <DialogDescription>
            Alterações persistidas no Supabase de desenvolvimento com controle de versão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <EditFields state={activeState} data={data} employeeDetail={employeeDetail} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({
  state,
  data,
  employeeDetail,
  onClose,
}: {
  state: Exclude<HrRecordActionState, null>;
  data: HrDirectory;
  employeeDetail: EmployeeSensitiveDetail | null;
  onClose: () => void;
}) {
  const fields = viewFields(state, data, employeeDetail);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle(state)}</DialogTitle>
          <DialogDescription>
            Informações organizadas por registro e relacionamento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <Detail key={label} label={label} value={value} />
          ))}
        </div>
        <DialogFooter>
          {state.entity === "document" && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await downloadEmployeeDocument(state.record.id);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Falha ao baixar documento.",
                  );
                }
              }}
            >
              Baixar documento
            </Button>
          )}
          <DialogClose asChild>
            <Button>Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  state,
  data,
  submitting,
  onClose,
  onDelete,
}: {
  state: Exclude<HrRecordActionState, null>;
  data: HrDirectory;
  submitting: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir registro</DialogTitle>
          <DialogDescription>
            O registro será removido da operação atual, com histórico e relacionamentos preservados.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{recordLabel(state, data)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta ação respeita o status e a versão atual.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" disabled={submitting} onClick={() => void onDelete()}>
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFields({
  state,
  data,
  employeeDetail,
}: {
  state: Exclude<HrRecordActionState, null>;
  data: HrDirectory;
  employeeDetail: EmployeeSensitiveDetail | null;
}) {
  if (state.entity === "employee" && employeeDetail) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Nome completo">
          <Input name="legalName" defaultValue={employeeDetail.legalName} required />
        </Field>
        <Field label="Nome social">
          <Input name="socialName" defaultValue={employeeDetail.socialName ?? ""} />
        </Field>
        <Field label="Nascimento">
          <Input name="birthDate" type="date" defaultValue={employeeDetail.birthDate} required />
        </Field>
        <Field label="E-mail pessoal">
          <Input
            name="personalEmail"
            type="email"
            defaultValue={employeeDetail.personalEmail ?? ""}
          />
        </Field>
        <Field label="Telefone">
          <Input name="phone" defaultValue={employeeDetail.phone ?? ""} />
        </Field>
        <Field label="E-mail corporativo">
          <Input
            name="corporateEmail"
            type="email"
            defaultValue={employeeDetail.corporateEmail ?? ""}
          />
        </Field>
        <Field label="Unidade">
          <OptionSelect
            name="businessUnitId"
            options={data.businessUnits}
            defaultValue={employeeDetail.businessUnitId}
            required
          />
        </Field>
        <Field label="Departamento">
          <OptionSelect
            name="departmentId"
            options={data.departments}
            defaultValue={employeeDetail.departmentId ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Cargo">
          <OptionSelect
            name="positionId"
            options={data.positions}
            defaultValue={employeeDetail.positionId ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Gestor">
          <EmployeeSelect
            name="managerEmployeeId"
            data={data}
            defaultValue={employeeDetail.managerEmployeeId ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Data de entrada">
          <Input name="hireDate" type="date" defaultValue={employeeDetail.hireDate} required />
        </Field>
        <Field label="Vínculo">
          <Select
            name="employmentType"
            options={employmentTypeOptions}
            defaultValue={employeeDetail.employmentType}
          />
        </Field>
        <Field label="Modalidade">
          <Select
            name="workMode"
            options={workModeOptions}
            defaultValue={employeeDetail.workMode}
          />
        </Field>
        <Field label="Jornada">
          <Input name="workSchedule" defaultValue={employeeDetail.workSchedule ?? ""} />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            options={employeeStatusOptions}
            defaultValue={employeeDetail.status}
          />
        </Field>
        <Field label="Observações" className="md:col-span-2 xl:col-span-3">
          <Textarea name="internalNotes" defaultValue={employeeDetail.internalNotes ?? ""} />
        </Field>
      </div>
    );
  }

  if (state.entity === "payment") {
    const record = state.record;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Colaborador">
          <EmployeeSelect
            name="employeeId"
            data={data}
            defaultValue={record.employee_id}
            required
          />
        </Field>
        <Field label="Contrato">
          <OptionSelect
            name="contractId"
            options={data.contracts.map((item) => ({
              id: item.id,
              name: `${employeeName(data, item.employee_id)} · ${item.contract_type}`,
            }))}
            defaultValue={record.contract_id ?? ""}
            empty="Sem contrato"
          />
        </Field>
        <Field label="Competência">
          <Input
            name="competence"
            type="month"
            defaultValue={record.competence.slice(0, 7)}
            required
          />
        </Field>
        <Field label="Data prevista">
          <Input name="expectedDate" type="date" defaultValue={record.expected_date} required />
        </Field>
        <Field label="Descrição" className="md:col-span-2">
          <Input name="description" defaultValue={record.description} required />
        </Field>
        <Field label="Valor base">
          <Input
            name="baseAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record.base_amount}
            required
          />
        </Field>
        <Field label="Adicionais">
          <Input
            name="additions"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record.additions}
            required
          />
        </Field>
        <Field label="Descontos">
          <Input
            name="deductions"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record.informational_deductions}
            required
          />
        </Field>
        <Field label="Data de pagamento">
          <Input name="paymentDate" type="date" defaultValue={record.payment_date ?? ""} />
        </Field>
        <Field label="Forma de pagamento">
          <Input name="paymentMethod" defaultValue={record.payment_method ?? ""} />
        </Field>
        <Field label="Status">
          <Select name="status" options={paymentStatusOptions} defaultValue={record.status} />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" defaultValue={record.notes ?? ""} />
        </Field>
      </div>
    );
  }

  if (state.entity === "leave") {
    const record = state.record;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo">
          <OptionSelect
            name="leaveTypeId"
            options={data.leaveTypes}
            defaultValue={record.leave_type_id}
            required
          />
        </Field>
        <Field label="Gestor">
          <EmployeeSelect
            name="managerEmployeeId"
            data={data}
            defaultValue={record.manager_employee_id ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Data inicial">
          <Input name="startDate" type="date" defaultValue={record.start_date} required />
        </Field>
        <Field label="Data final">
          <Input name="endDate" type="date" defaultValue={record.end_date} required />
        </Field>
        <Field label="Status">
          <Select name="status" options={leaveStatusOptions} defaultValue={record.status} />
        </Field>
        <Field label="Motivo">
          <Input name="reason" defaultValue={record.reason ?? ""} />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" defaultValue={record.notes ?? ""} />
        </Field>
      </div>
    );
  }

  if (state.entity === "document") {
    const record = state.record;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo">
          <OptionSelect
            name="documentTypeId"
            options={data.documentTypes}
            defaultValue={record.document_type_id}
            required
          />
        </Field>
        <Field label="Nome">
          <Input name="name" defaultValue={record.name} required />
        </Field>
        <Field label="Emissão">
          <Input name="issuedAt" type="date" defaultValue={record.issued_at ?? ""} />
        </Field>
        <Field label="Validade">
          <Input name="expiresAt" type="date" defaultValue={record.expires_at ?? ""} />
        </Field>
        <Field label="Visibilidade">
          <Select name="visibility" options={visibilityOptions} defaultValue={record.visibility} />
        </Field>
        <Field label="Status">
          <Select name="status" options={documentStatusOptions} defaultValue={record.status} />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" />
        </Field>
      </div>
    );
  }

  return null;
}

function viewFields(
  state: Exclude<HrRecordActionState, null>,
  data: HrDirectory,
  detail: EmployeeSensitiveDetail | null,
): Array<[string, string]> {
  if (state.entity === "employee") {
    if (!detail) return [];
    return [
      ["Nome", detail.legalName],
      ["CPF", formatCpf(detail.cpf)],
      ["Nascimento", formatDate(detail.birthDate)],
      ["E-mail pessoal", detail.personalEmail ?? "—"],
      ["Telefone", detail.phone ?? "—"],
      ["E-mail corporativo", detail.corporateEmail ?? "—"],
      ["Unidade", optionName(data.businessUnits, detail.businessUnitId)],
      ["Departamento", optionName(data.departments, detail.departmentId)],
      ["Cargo", optionName(data.positions, detail.positionId)],
      ["Gestor", detail.managerEmployeeId ? employeeName(data, detail.managerEmployeeId) : "—"],
      ["Entrada", formatDate(detail.hireDate)],
      ["Vínculo", detail.employmentType],
      ["Modalidade", detail.workMode],
      ["Status", detail.status],
      ["Jornada", detail.workSchedule ?? "—"],
      ["Observações", detail.internalNotes ?? "—"],
    ];
  }
  if (state.entity === "payment") {
    const r = state.record;
    return [
      ["Colaborador", employeeName(data, r.employee_id)],
      ["Competência", formatMonth(r.competence)],
      ["Descrição", r.description],
      ["Valor base", money(r.base_amount)],
      ["Adicionais", money(r.additions)],
      ["Descontos", money(r.informational_deductions)],
      ["Valor final", money(r.final_amount)],
      ["Previsto", formatDate(r.expected_date)],
      ["Pagamento", r.payment_date ? formatDate(r.payment_date) : "—"],
      ["Forma", r.payment_method ?? "—"],
      ["Status", r.status],
      ["Observações", r.notes ?? "—"],
    ];
  }
  if (state.entity === "leave") {
    const r = state.record;
    return [
      ["Colaborador", employeeName(data, r.employee_id)],
      ["Tipo", optionName(data.leaveTypes, r.leave_type_id)],
      ["Início", formatDate(r.start_date)],
      ["Fim", formatDate(r.end_date)],
      ["Dias", String(r.duration_days)],
      ["Gestor", r.manager_employee_id ? employeeName(data, r.manager_employee_id) : "—"],
      ["Status", r.status],
      ["Motivo", r.reason ?? "—"],
      ["Decisão", r.decision_at ? formatDateTime(r.decision_at) : "—"],
      ["Recusa", r.rejection_reason ?? "—"],
      ["Observações", r.notes ?? "—"],
    ];
  }
  if (state.entity === "document") {
    const r = state.record;
    return [
      ["Documento", r.name],
      ["Arquivo", r.original_file_name],
      ["Colaborador", employeeName(data, r.employee_id)],
      ["Tipo", optionName(data.documentTypes, r.document_type_id)],
      ["Visibilidade", r.visibility],
      ["Status", r.status],
      ["Emissão", r.issued_at ? formatDate(r.issued_at) : "—"],
      ["Validade", r.expires_at ? formatDate(r.expires_at) : "—"],
      ["Enviado", formatDateTime(r.uploaded_at)],
      ["Tamanho", formatBytes(r.size_bytes)],
    ];
  }
  return [];
}

function dialogTitle(state: Exclude<HrRecordActionState, null>) {
  const action = state.action === "view" ? "Ver" : state.action === "edit" ? "Editar" : "Excluir";
  const entity = {
    employee: "colaborador",
    payment: "pagamento",
    leave: "ausência",
    document: "documento",
  }[state.entity];
  return `${action} ${entity}`;
}
function recordId(state: Exclude<HrRecordActionState, null>) {
  return state.entity === "employee" ? state.record.employee_id : state.record.id;
}
function recordVersion(state: Exclude<HrRecordActionState, null>) {
  return state.entity === "employee" ? state.record.employee_version : state.record.version;
}
function recordLabel(state: Exclude<HrRecordActionState, null>, data: HrDirectory) {
  if (state.entity === "employee") return state.record.display_name;
  if (state.entity === "payment")
    return `${employeeName(data, state.record.employee_id)} · ${state.record.description}`;
  if (state.entity === "leave")
    return `${employeeName(data, state.record.employee_id)} · ${formatDate(state.record.start_date)}`;
  return state.record.name;
}
function employeeName(data: HrDirectory, id: string) {
  return data.employees.find((item) => item.employee_id === id)?.display_name ?? id;
}
function optionName(options: Array<{ id: string; name: string }>, id: string | null) {
  return id ? (options.find((item) => item.id === id)?.name ?? id) : "—";
}
function required(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`Campo obrigatório: ${name}.`);
  return value.trim();
}
function optional(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
function formatMonth(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${value.slice(0, 7)}-01T12:00:00`),
  );
}
function formatCpf(value: string) {
  return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

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
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value}</p>
    </div>
  );
}
function OptionSelect({
  name,
  options,
  defaultValue,
  required,
  empty,
}: {
  name: string;
  options: Array<{ id: string; name: string }>;
  defaultValue: string;
  required?: boolean;
  empty?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required={required} className={selectClass}>
      {empty && <option value="">{empty}</option>}
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
function EmployeeSelect({
  name,
  data,
  defaultValue,
  required,
  empty,
}: {
  name: string;
  data: HrDirectory;
  defaultValue: string;
  required?: boolean;
  empty?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required={required} className={selectClass}>
      {empty && <option value="">{empty}</option>}
      {data.employees
        .filter((item) => item.status !== "DESLIGADO")
        .map((item) => (
          <option key={item.employee_id} value={item.employee_id}>
            {item.display_name} · {item.unit_code}
          </option>
        ))}
    </select>
  );
}
function Select({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required className={selectClass}>
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

const employmentTypeOptions = ["CLT", "PJ", "FREELANCER", "ESTAGIO", "SOCIO", "OUTRO"].map(
  (value) => ({ value, label: value.replace("ESTAGIO", "Estágio").replace("SOCIO", "Sócio") }),
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
const paymentStatusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "CANCELADO", label: "Cancelado" },
];
const leaveStatusOptions = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "SOLICITADO", label: "Solicitado" },
  { value: "RECUSADO", label: "Recusado" },
  { value: "CANCELADO", label: "Cancelado" },
];
const visibilityOptions = [
  { value: "RH_ONLY", label: "Somente RH" },
  { value: "EMPLOYEE_AND_RH", label: "Colaborador e RH" },
  { value: "MANAGER_AND_RH", label: "Gestor e RH" },
  { value: "FINANCE_AND_RH", label: "Financeiro e RH" },
];
const documentStatusOptions = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "EXPIRED", label: "Expirado" },
  { value: "REVOKED", label: "Revogado" },
];
