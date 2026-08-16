import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/shared/utils/cn";

export type SortDirection = "asc" | "desc";

export interface SortableTableHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: "left" | "right";
  onSort: () => void;
}

export function SortableTableHeader({
  label,
  active,
  direction,
  align = "left",
  onSort,
}: SortableTableHeaderProps) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  const currentDirection = direction === "asc" ? "crescente" : "decrescente";
  const nextDirection = active && direction === "asc" ? "decrescente" : "crescente";
  const actionLabel = active
    ? `${label}: ordem ${currentDirection}. Ativar para ordenar em ordem ${nextDirection}`
    : `Ordenar ${label} em ordem crescente`;

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-3 py-3", align === "right" ? "text-right" : "text-left")}
    >
      <button
        type="button"
        aria-label={actionLabel}
        onClick={onSort}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          align === "right" && "justify-end",
        )}
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn("h-3.5 w-3.5", active ? "text-foreground" : "text-muted-foreground")}
        />
      </button>
    </th>
  );
}
