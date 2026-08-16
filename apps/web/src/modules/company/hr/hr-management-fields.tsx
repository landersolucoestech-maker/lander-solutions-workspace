import type { ReactNode } from "react";

import { Label } from "@/shared/components/ui/label";
import type { HrDirectory, HrOption } from "./types";

export const selectClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

export const employmentTypeOptions: Array<[string, string]> = [
  ["CLT", "CLT"],
  ["PJ", "Pessoa jurídica"],
  ["FREELANCER", "Freelancer"],
  ["ESTAGIO", "Estágio"],
  ["SOCIO", "Sócio"],
  ["OUTRO", "Outro"],
];

export const workModeOptions: Array<[string, string]> = [
  ["PRESENCIAL", "Presencial"],
  ["HIBRIDO", "Híbrido"],
  ["REMOTO", "Remoto"],
];

export const employeeStatusOptions: Array<[string, string]> = [
  ["ATIVO", "Ativo"],
  ["AFASTADO", "Afastado"],
  ["DESLIGADO", "Desligado"],
];

export const contractStatusOptions: Array<[string, string]> = [
  ["RASCUNHO", "Rascunho"],
  ["ATIVO", "Ativo"],
  ["ENCERRADO", "Encerrado"],
  ["CANCELADO", "Cancelado"],
  ["VENCIDO", "Vencido"],
];

export const paymentFrequencyOptions: Array<[string, string]> = [
  ["MENSAL", "Mensal"],
  ["QUINZENAL", "Quinzenal"],
  ["SEMANAL", "Semanal"],
  ["POR_PROJETO", "Por projeto"],
  ["POR_HORA", "Por hora"],
  ["OUTRO", "Outro"],
];

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Hint({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={`rounded-sm border p-4 text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </div>
  );
}

export function OptionSelect({
  name,
  options,
  defaultValue,
  empty,
  required,
}: {
  name: string;
  options: HrOption[];
  defaultValue?: string;
  empty?: string;
  required?: boolean;
}) {
  return (
    <select
      className={selectClass}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
    >
      {empty || !required ? <option value="">{empty ?? "Selecione"}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.code ? `${option.code} · ` : ""}
          {option.name}
        </option>
      ))}
    </select>
  );
}

export function EmployeeOptionSelect({
  name,
  data,
  defaultValue,
  excludedEmployeeId,
}: {
  name: string;
  data: HrDirectory;
  defaultValue?: string;
  excludedEmployeeId?: string;
}) {
  return (
    <select className={selectClass} name={name} defaultValue={defaultValue ?? ""}>
      <option value="">Não definido</option>
      {data.employees
        .filter((employee) => employee.employee_id !== excludedEmployeeId)
        .map((employee) => (
          <option key={employee.employee_id} value={employee.employee_id}>
            {employee.display_name} · {employee.unit_code}
          </option>
        ))}
    </select>
  );
}

export function ValueSelect({
  name,
  options,
  defaultValue,
  empty,
  required,
}: {
  name: string;
  options: Array<[string, string]>;
  defaultValue?: string;
  empty?: string;
  required?: boolean;
}) {
  return (
    <select
      className={selectClass}
      name={name}
      defaultValue={defaultValue ?? ""}
      required={required}
    >
      {empty || !required ? <option value="">{empty ?? "Selecione"}</option> : null}
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function employeeName(data: HrDirectory, employeeId: string) {
  return (
    data.employees.find((employee) => employee.employee_id === employeeId)?.display_name ??
    "Colaborador"
  );
}

export function optionName(options: HrOption[], id: string) {
  return options.find((option) => option.id === id)?.name ?? "Não identificado";
}

export function required(form: FormData, name: string) {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }
  return value.trim();
}

export function optional(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalNumber(form: FormData, name: string) {
  const value = optional(form, name);
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Informe um valor numérico válido.");
  }
  return parsed;
}

export function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
