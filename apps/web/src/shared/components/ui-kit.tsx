import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/shared/utils/cn";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0) / 100);
}

export function PageHeader({
  actions,
  action,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  action?: ReactNode;
}) {
  const pageActions = actions ?? action;
  if (!pageActions) return null;

  return <div className="flex flex-wrap items-center justify-end gap-2">{pageActions}</div>;
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-positive",
    negative: "text-destructive",
    warning: "text-warning",
  }[tone];

  return (
    <Card className="gap-0 rounded-sm py-4 shadow-none">
      <CardContent className="px-4">
        <p className="label-caps">{label}</p>
        <p className={cn("num mt-2 text-2xl font-semibold", toneClass)}>{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function MoneyKpi({
  label,
  brl,
  hint,
  tone,
}: {
  label: string;
  brl: number;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  return <Kpi label={label} value={formatMoney(brl)} hint={hint} tone={tone} />;
}

export function Panel({
  title,
  description,
  children,
  className,
  headerClassName,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className={cn("gap-0 rounded-sm py-0 shadow-none", className)}>
      <CardHeader
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5",
          headerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="px-0 py-0">{children}</CardContent>
    </Card>
  );
}

const statusTones: Record<string, string> = {
  ativo: "bg-positive/12 text-positive border-positive/25",
  active: "bg-positive/12 text-positive border-positive/25",
  vigente: "bg-positive/12 text-positive border-positive/25",
  recebido: "bg-positive/12 text-positive border-positive/25",
  paid: "bg-positive/12 text-positive border-positive/25",
  pago: "bg-positive/12 text-positive border-positive/25",
  posted: "bg-positive/12 text-positive border-positive/25",
  approved: "bg-positive/12 text-positive border-positive/25",
  completed: "bg-positive/12 text-positive border-positive/25",
  registrado: "bg-positive/12 text-positive border-positive/25",
  deferido: "bg-positive/12 text-positive border-positive/25",
  Produção: "bg-positive/12 text-positive border-positive/25",
  aberto: "bg-info/12 text-info border-info/25",
  open: "bg-info/12 text-info border-info/25",
  draft: "bg-muted text-muted-foreground border-border",
  protocolado: "bg-info/12 text-info border-info/25",
  publicado: "bg-info/12 text-info border-info/25",
  published: "bg-info/12 text-info border-info/25",
  "em exame": "bg-info/12 text-info border-info/25",
  Homologação: "bg-info/12 text-info border-info/25",
  renovação: "bg-warning/15 text-warning-foreground border-warning/35",
  pending: "bg-warning/15 text-warning-foreground border-warning/35",
  pending_approval: "bg-warning/15 text-warning-foreground border-warning/35",
  "em cobrança": "bg-warning/15 text-warning-foreground border-warning/35",
  "aguardando aprovação": "bg-warning/15 text-warning-foreground border-warning/35",
  "em assinatura": "bg-warning/15 text-warning-foreground border-warning/35",
  "em organização": "bg-warning/15 text-warning-foreground border-warning/35",
  Desenvolvimento: "bg-warning/15 text-warning-foreground border-warning/35",
  vencido: "bg-destructive/12 text-destructive border-destructive/25",
  overdue: "bg-destructive/12 text-destructive border-destructive/25",
  rejected: "bg-destructive/12 text-destructive border-destructive/25",
  cancelled: "bg-destructive/12 text-destructive border-destructive/25",
  inadimplente: "bg-destructive/12 text-destructive border-destructive/25",
  encerrado: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
  prospect: "bg-muted text-muted-foreground border-border",
  planejado: "bg-muted text-muted-foreground border-border",
  Planejado: "bg-muted text-muted-foreground border-border",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        statusTones[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {status}
    </span>
  );
}

export function UnitTag({ children }: { children: ReactNode }) {
  return (
    <span className="num inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium tracking-tight text-secondary-foreground">
      {children}
    </span>
  );
}

export function Delta({ value }: { value: number }) {
  const tone =
    value > 0 ? "text-destructive" : value < 0 ? "text-positive" : "text-muted-foreground";
  return (
    <span className={cn("num text-xs", tone)}>
      {value > 0 ? "+" : ""}
      {formatPercent(value)}
    </span>
  );
}

export function EmptyRow({
  colSpan,
  label,
  message,
}: {
  colSpan: number;
  label?: string;
  message?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-muted-foreground">
        {label ?? message ?? "Nenhum registro encontrado."}
      </td>
    </tr>
  );
}
