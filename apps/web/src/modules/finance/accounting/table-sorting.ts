import type { SortDirection } from "@/shared/components/sortable-table-header";

export interface AccountingTableSort<Key extends string> {
  key: Key;
  direction: SortDirection;
}

type SortValue = number | string;

const textCollator = new Intl.Collator("pt-BR", {
  sensitivity: "base",
});

export function nextAccountingSort<Key extends string>(
  current: AccountingTableSort<Key>,
  key: Key,
): AccountingTableSort<Key> {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

export function sortAccountingRows<Row>(
  rows: Row[],
  direction: SortDirection,
  getValue: (row: Row) => SortValue,
): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = getValue(left.row);
      const rightValue = getValue(right.row);
      const comparison =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : textCollator.compare(String(leftValue), String(rightValue));
      if (comparison === 0) return left.index - right.index;
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);
}
