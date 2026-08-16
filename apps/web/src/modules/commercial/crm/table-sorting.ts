import type { SortDirection } from "@/shared/components/sortable-table-header";

export interface TableSort<Key extends string> {
  key: Key;
  direction: SortDirection;
}

type SortValue = number | string | null | undefined;

const textCollator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

export function nextTableSort<Key extends string>(
  current: TableSort<Key> | null,
  key: Key,
): TableSort<Key> {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

export function sortTableRows<Row>(
  rows: Row[],
  direction: SortDirection,
  getValue: (row: Row) => SortValue,
): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const comparison = compareValues(getValue(left.row), getValue(right.row));
      if (comparison === 0) return left.index - right.index;
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);
}

function compareValues(left: SortValue, right: SortValue): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return textCollator.compare(String(left), String(right));
}
