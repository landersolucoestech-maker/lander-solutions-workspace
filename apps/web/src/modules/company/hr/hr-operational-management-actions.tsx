import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, HandCoins, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { updateLeave, updatePayment } from "./hr-admin-mutations";
import { HrLeaveEditForm } from "./hr-leave-edit-form";
import {
  Field,
  Hint,
  employeeName,
  formatDate,
  optional,
  required,
  selectClass,
} from "./hr-management-fields";
import { getEmployeePaymentDetail, getLeaveRequestDetail } from "./hr-operational-queries";
import { HrPaymentEditForm } from "./hr-payment-edit-form";
import { canEditLeave, canEditPayment, competenceMonthToDate } from "./lifecycle-rules";
import type { EmployeePayment, HrDirectory, LeaveRequest } from "./types";

type OperationalMode = "edit-leave" | "edit-payment" | null;

interface Props {
  data: HrDirectory;
  onSuccess: () => Promise<void>;
  showLeave?: boolean;
  showPayment?: boolean;
}

export function HrOperationalManagementActions({
  data,
  onSuccess,
  showLeave = true,
  showPayment = true,
}: Props) {
  const [mode, setMode] = useState<OperationalMode>(null);
  const [leaveId, setLeaveId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const editableLeaves = data.leaves.filter((request) => canEditLeave(request.status));
  const editablePayments = data.payments.filter((payment) => canEditPayment(payment.status));
  const leaveDetailQuery = useQuery({
    queryKey: ["hr-leave-detail", leaveId],
    queryFn: () => getLeaveRequestDetail(leaveId),
    enabled: mode === "edit-leave" && Boolean(leaveId),
  });
  const paymentDetailQuery = useQuery({
    queryKey: ["hr-payment-detail", paymentId],
    queryFn: () => getEmployeePaymentDetail(paymentId),
    enabled: mode === "edit-payment" && Boolean(paymentId),
  });

  function closeDialog() {
    setMode(null);
    setLeaveId("");
    setPaymentId("");
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>, request: LeaveRequest) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      await updateLeave({
        requestId: request.id,
        leaveTypeId: required(form, "leaveTypeId"),
        startDate: required(form, "startDate"),
        endDate: required(form, "endDate"),
        reason: optional(form, "reason"),
        documentStoragePath: request.document_storage_path,
        submit: required(form, "requestStatus") === "SOLICITADO",
        managerEmployeeId: optional(form, "managerEmployeeId"),
        notes: optional(form, "notes"),
        expectedVersion: request.version,
      });
      await onSuccess();
      toast.success("Solicitação de ausência atualizada.");
      closeDialog();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>, payment: EmployeePayment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      await updatePayment({
        paymentId: payment.id,
        contractId: optional(form, "contractId"),
        competence: competenceMonthToDate(required(form, "competenceMonth")),
        description: required(form, "description"),
        baseAmount: nonnegativeNumber(form, "baseAmount"),
        additions: nonnegativeNumber(form, "additions"),
        informationalDeductions: nonnegativeNumber(form, "informationalDeductions"),
        expectedDate: required(form, "expectedDate"),
        paymentDate: payment.payment_date,
        paymentMethod: optional(form, "paymentMethod"),
        status: required(form, "status"),
        proofStoragePath: payment.proof_storage_path,
        notes: optional(form, "notes"),
        expectedVersion: payment.version,
      });
      await onSuccess();
      toast.success("Pagamento administrativo atualizado.");
      closeDialog();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {showLeave && data.permissions.manageLeave ? (
        <Button
          variant="outline"
          onClick={() => setMode("edit-leave")}
          disabled={editableLeaves.length === 0}
        >
          <CalendarDays /> Editar ausência
        </Button>
      ) : null}
      {showPayment && data.permissions.managePayments ? (
        <Button
          variant="outline"
          onClick={() => setMode("edit-payment")}
          disabled={editablePayments.length === 0}
        >
          <HandCoins /> Editar pagamento
        </Button>
      ) : null}

      <Dialog open={mode === "edit-leave"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar solicitação de ausência</DialogTitle>
            <DialogDescription>
              Somente solicitações em rascunho ou ainda aguardando decisão podem ser alteradas.
            </DialogDescription>
          </DialogHeader>
          <Field label="Solicitação">
            <select
              className={selectClass}
              value={leaveId}
              onChange={(event) => setLeaveId(event.target.value)}
            >
              <option value="">Selecione</option>
              {editableLeaves.map((request) => (
                <option key={request.id} value={request.id}>
                  {employeeName(data, request.employee_id)} · {formatDate(request.start_date)} a{" "}
                  {formatDate(request.end_date)} · {request.status}
                </option>
              ))}
            </select>
          </Field>
          {!leaveId ? (
            <Hint>Selecione a solicitação que será editada.</Hint>
          ) : leaveDetailQuery.isLoading ? (
            <Loading label="Carregando solicitação completa…" />
          ) : leaveDetailQuery.isError || !leaveDetailQuery.data ? (
            <Hint tone="error">{errorMessage(leaveDetailQuery.error)}</Hint>
          ) : (
            <HrLeaveEditForm
              key={`${leaveDetailQuery.data.id}-${leaveDetailQuery.data.version}`}
              request={leaveDetailQuery.data}
              data={data}
              submitting={submitting}
              onCancel={closeDialog}
              onSubmit={submitLeave}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "edit-payment"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar pagamento administrativo</DialogTitle>
            <DialogDescription>
              Pagamentos já liquidados ou cancelados permanecem imutáveis neste fluxo.
            </DialogDescription>
          </DialogHeader>
          <Field label="Pagamento">
            <select
              className={selectClass}
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
            >
              <option value="">Selecione</option>
              {editablePayments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {employeeName(data, payment.employee_id)} · {payment.description} ·{" "}
                  {payment.status}
                </option>
              ))}
            </select>
          </Field>
          {!paymentId ? (
            <Hint>Selecione o pagamento que será editado.</Hint>
          ) : paymentDetailQuery.isLoading ? (
            <Loading label="Carregando pagamento completo…" />
          ) : paymentDetailQuery.isError || !paymentDetailQuery.data ? (
            <Hint tone="error">{errorMessage(paymentDetailQuery.error)}</Hint>
          ) : (
            <HrPaymentEditForm
              key={`${paymentDetailQuery.data.id}-${paymentDetailQuery.data.version}`}
              payment={paymentDetailQuery.data}
              data={data}
              submitting={submitting}
              onCancel={closeDialog}
              onSubmit={submitPayment}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <LoaderCircle className="animate-spin" /> {label}
    </div>
  );
}

function nonnegativeNumber(form: FormData, name: string) {
  const value = Number(required(form, name));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Informe valores numéricos não negativos.");
  }
  return value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada.";
}
