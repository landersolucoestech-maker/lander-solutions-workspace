import type { FormEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { DialogFooter } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Field, ValueSelect, employeeName, selectClass } from "./hr-management-fields";
import type { EmployeePayment, HrDirectory } from "./types";

interface Props {
  payment: EmployeePayment;
  data: HrDirectory;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, payment: EmployeePayment) => Promise<void>;
}

export function HrPaymentEditForm({ payment, data, submitting, onCancel, onSubmit }: Props) {
  const employeeContracts = data.contracts.filter(
    (contract) => contract.employee_id === payment.employee_id,
  );

  return (
    <form onSubmit={(event) => void onSubmit(event, payment)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Colaborador">
          <Input value={employeeName(data, payment.employee_id)} disabled />
        </Field>
        <Field label="Contrato relacionado">
          <select
            className={selectClass}
            name="contractId"
            defaultValue={payment.contract_id ?? ""}
          >
            <option value="">Sem contrato relacionado</option>
            {employeeContracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.contract_type} · {contract.status} · {formatDate(contract.start_date)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Competência">
          <Input
            name="competenceMonth"
            type="month"
            defaultValue={payment.competence.slice(0, 7)}
            required
          />
        </Field>
        <Field label="Data prevista">
          <Input name="expectedDate" type="date" defaultValue={payment.expected_date} required />
        </Field>
        <Field label="Descrição" className="md:col-span-2">
          <Input name="description" defaultValue={payment.description} required />
        </Field>
        <Field label="Valor base">
          <Input
            name="baseAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={payment.base_amount}
            required
          />
        </Field>
        <Field label="Adicionais">
          <Input
            name="additions"
            type="number"
            min="0"
            step="0.01"
            defaultValue={payment.additions}
            required
          />
        </Field>
        <Field label="Descontos informativos">
          <Input
            name="informationalDeductions"
            type="number"
            min="0"
            step="0.01"
            defaultValue={payment.informational_deductions}
            required
          />
        </Field>
        <Field label="Forma de pagamento">
          <Input name="paymentMethod" defaultValue={payment.payment_method ?? ""} />
        </Field>
        <Field label="Status">
          <ValueSelect
            name="status"
            options={[
              ["PENDENTE", "Pendente"],
              ["AGENDADO", "Agendado"],
              ["ATRASADO", "Atrasado"],
              ["CANCELADO", "Cancelado"],
            ]}
            defaultValue={payment.status}
            required
          />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={payment.notes ?? ""} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando…" : "Salvar pagamento"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
