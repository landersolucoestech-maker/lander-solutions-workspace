import type { FormEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { DialogFooter } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  EmployeeOptionSelect,
  Field,
  OptionSelect,
  ValueSelect,
  employeeName,
} from "./hr-management-fields";
import type { HrDirectory, LeaveRequest } from "./types";

interface Props {
  request: LeaveRequest;
  data: HrDirectory;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, request: LeaveRequest) => Promise<void>;
}

export function HrLeaveEditForm({ request, data, submitting, onCancel, onSubmit }: Props) {
  return (
    <form onSubmit={(event) => void onSubmit(event, request)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Colaborador">
          <Input value={employeeName(data, request.employee_id)} disabled />
        </Field>
        <Field label="Tipo de ausência">
          <OptionSelect
            name="leaveTypeId"
            options={data.leaveTypes}
            defaultValue={request.leave_type_id}
            required
          />
        </Field>
        <Field label="Data inicial">
          <Input name="startDate" type="date" defaultValue={request.start_date} required />
        </Field>
        <Field label="Data final">
          <Input name="endDate" type="date" defaultValue={request.end_date} required />
        </Field>
        <Field label="Gestor responsável">
          <EmployeeOptionSelect
            name="managerEmployeeId"
            data={data}
            defaultValue={request.manager_employee_id ?? ""}
            excludedEmployeeId={request.employee_id}
          />
        </Field>
        <Field label="Situação da solicitação">
          <ValueSelect
            name="requestStatus"
            options={[
              ["RASCUNHO", "Rascunho"],
              ["SOLICITADO", "Solicitada"],
            ]}
            defaultValue={request.status}
            required
          />
        </Field>
        <Field label="Motivo" className="md:col-span-2">
          <Textarea name="reason" rows={3} defaultValue={request.reason ?? ""} />
        </Field>
        <Field label="Observações internas" className="md:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={request.notes ?? ""} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando…" : "Salvar solicitação"}
        </Button>
      </DialogFooter>
    </form>
  );
}
