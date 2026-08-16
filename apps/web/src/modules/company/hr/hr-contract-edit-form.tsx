import type { FormEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { DialogFooter } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Field,
  OptionSelect,
  ValueSelect,
  contractStatusOptions,
  employeeName,
  employmentTypeOptions,
  optionName,
  paymentFrequencyOptions,
  workModeOptions,
} from "./hr-management-fields";
import type { EmploymentContract, HrDirectory } from "./types";

interface Props {
  contract: EmploymentContract;
  data: HrDirectory;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, contract: EmploymentContract) => Promise<void>;
}

export function HrContractEditForm({ contract, data, submitting, onCancel, onSubmit }: Props) {
  return (
    <form onSubmit={(event) => void onSubmit(event, contract)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Colaborador">
          <Input value={employeeName(data, contract.employee_id)} disabled />
        </Field>
        <Field label="Empresa contratante">
          <Input value={optionName(data.legalEntities, contract.legal_entity_id)} disabled />
        </Field>
        <Field label="Cargo">
          <OptionSelect
            name="positionId"
            options={data.positions}
            defaultValue={contract.position_id ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Tipo">
          <ValueSelect
            name="contractType"
            options={employmentTypeOptions}
            defaultValue={contract.contract_type}
            required
          />
        </Field>
        <Field label="Data inicial">
          <Input name="startDate" type="date" defaultValue={contract.start_date} required />
        </Field>
        <Field label="Data final">
          <Input name="endDate" type="date" defaultValue={contract.end_date ?? ""} />
        </Field>
        <Field label="Valor">
          <Input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={contract.amount ?? ""}
          />
        </Field>
        <Field label="Frequência">
          <ValueSelect
            name="paymentFrequency"
            options={paymentFrequencyOptions}
            defaultValue={contract.payment_frequency ?? ""}
            empty="Não informada"
          />
        </Field>
        <Field label="Forma de pagamento">
          <Input name="paymentMethod" defaultValue={contract.payment_method ?? ""} />
        </Field>
        <Field label="Modalidade">
          <ValueSelect
            name="workMode"
            options={workModeOptions}
            defaultValue={contract.work_mode}
            required
          />
        </Field>
        <Field label="Jornada">
          <Input name="workSchedule" defaultValue={contract.work_schedule ?? ""} />
        </Field>
        <Field label="Status">
          <ValueSelect
            name="status"
            options={contractStatusOptions}
            defaultValue={contract.status}
            required
          />
        </Field>
        <Field label="Contrato principal">
          <ValueSelect
            name="isPrimary"
            options={[
              ["true", "Sim"],
              ["false", "Não"],
            ]}
            defaultValue={String(contract.is_primary)}
            required
          />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={contract.notes ?? ""} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando…" : "Salvar contrato"}
        </Button>
      </DialogFooter>
    </form>
  );
}
