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
  employeeStatusOptions,
  employmentTypeOptions,
  workModeOptions,
} from "./hr-management-fields";
import type { EmployeeSensitiveDetail, HrDirectory } from "./types";

interface Props {
  detail: EmployeeSensitiveDetail;
  data: HrDirectory;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, detail: EmployeeSensitiveDetail) => Promise<void>;
}

export function HrEmployeeEditForm({ detail, data, submitting, onCancel, onSubmit }: Props) {
  return (
    <form onSubmit={(event) => void onSubmit(event, detail)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Nome completo">
          <Input name="legalName" defaultValue={detail.legalName} required />
        </Field>
        <Field label="Nome social">
          <Input name="socialName" defaultValue={detail.socialName ?? ""} />
        </Field>
        <Field label="CPF">
          <Input value={detail.cpf} disabled />
        </Field>
        <Field label="Data de nascimento">
          <Input name="birthDate" type="date" defaultValue={detail.birthDate} required />
        </Field>
        <Field label="E-mail pessoal">
          <Input name="personalEmail" type="email" defaultValue={detail.personalEmail ?? ""} />
        </Field>
        <Field label="Telefone">
          <Input name="phone" defaultValue={detail.phone ?? ""} />
        </Field>
        <Field label="E-mail corporativo">
          <Input name="corporateEmail" type="email" defaultValue={detail.corporateEmail ?? ""} />
        </Field>
        <Field label="Usuário do sistema">
          <OptionSelect
            name="userId"
            options={data.users}
            defaultValue={detail.userId ?? ""}
            empty="Sem conta vinculada"
          />
        </Field>
        <Field label="Unidade de negócio">
          <OptionSelect
            name="businessUnitId"
            options={data.businessUnits}
            defaultValue={detail.businessUnitId}
            required
          />
        </Field>
        <Field label="Departamento">
          <OptionSelect
            name="departmentId"
            options={data.departments}
            defaultValue={detail.departmentId ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Cargo">
          <OptionSelect
            name="positionId"
            options={data.positions}
            defaultValue={detail.positionId ?? ""}
            empty="Não definido"
          />
        </Field>
        <Field label="Gestor">
          <EmployeeOptionSelect
            name="managerEmployeeId"
            data={data}
            defaultValue={detail.managerEmployeeId ?? ""}
            excludedEmployeeId={detail.employeeId}
          />
        </Field>
        <Field label="Data de entrada">
          <Input name="hireDate" type="date" defaultValue={detail.hireDate} required />
        </Field>
        <Field label="Tipo de contratação">
          <ValueSelect
            name="employmentType"
            options={employmentTypeOptions}
            defaultValue={detail.employmentType}
            required
          />
        </Field>
        <Field label="Modalidade">
          <ValueSelect
            name="workMode"
            options={workModeOptions}
            defaultValue={detail.workMode}
            required
          />
        </Field>
        <Field label="Jornada">
          <Input name="workSchedule" defaultValue={detail.workSchedule ?? ""} />
        </Field>
        <Field label="Status">
          <ValueSelect
            name="status"
            options={employeeStatusOptions}
            defaultValue={detail.status}
            required
          />
        </Field>
        <Field label="Observações internas" className="md:col-span-2 xl:col-span-3">
          <Textarea name="internalNotes" rows={3} defaultValue={detail.internalNotes ?? ""} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando…" : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}
