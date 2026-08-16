import { useId, type HTMLAttributes, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  inputMode,
  maxLength,
  placeholder,
  helpText,
  disabled = false,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={onBlur}
      />
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  required = false,
  maxLength = 4000,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
        required={required}
        disabled={disabled}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${optionValue}-${optionLabel}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-9 items-center gap-2 rounded-sm border px-3 py-2 text-sm"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

export function RepeatableCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" /> Remover
        </Button>
      </div>
      {children}
    </div>
  );
}

export function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}

export function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm">{value || "—"}</div>
    </div>
  );
}
