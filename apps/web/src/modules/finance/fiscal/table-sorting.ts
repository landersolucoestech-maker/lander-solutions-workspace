import type { SortDirection } from "@/shared/components/sortable-table-header";

export interface FiscalTableSort<Key extends string> {
  key: Key;
  direction: SortDirection;
}

type SortValue = number | string | null | undefined;

const textCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });

export function nextFiscalSort<Key extends string>(
  current: FiscalTableSort<Key>,
  key: Key,
): FiscalTableSort<Key> {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

export function sortFiscalRows<Row>(
  rows: Row[],
  direction: SortDirection,
  getValue: (row: Row) => SortValue,
): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = getValue(left.row);
      const rightValue = getValue(right.row);
      if (leftValue == null && rightValue == null) return left.index - right.index;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      const comparison =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : textCollator.compare(String(leftValue), String(rightValue));
      if (comparison === 0) return left.index - right.index;
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);
}
