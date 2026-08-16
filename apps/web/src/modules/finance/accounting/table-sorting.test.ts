import { describe, expect, it } from "vitest";

import { nextAccountingSort, sortAccountingRows } from "./table-sorting";

describe("accounting table sorting", () => {
  it("toggles the active column and starts a new column ascending", () => {
    expect(nextAccountingSort({ key: "description", direction: "asc" }, "description")).toEqual({
      key: "description",
      direction: "desc",
    });
    expect(nextAccountingSort({ key: "description", direction: "desc" }, "revenue")).toEqual({
      key: "revenue",
      direction: "asc",
    });
  });

  it("sorts account codes and displayed categories using Portuguese collation", () => {
    const rows = [
      { code: "2.1", category: "Despesa" },
      { code: "10.1", category: "Ativo" },
      { code: "1.1", category: "Receita" },
    ];
    expect(sortAccountingRows(rows, "asc", (row) => row.code).map((row) => row.code)).toEqual([
      "1.1",
      "10.1",
      "2.1",
    ]);
    expect(
      sortAccountingRows(rows, "desc", (row) => row.category).map((row) => row.category),
    ).toEqual(["Receita", "Despesa", "Ativo"]);
  });

  it("sorts monetary values numerically without mutating source rows", () => {
    const rows = [{ amount: 10 }, { amount: -25 }, { amount: 2 }];
    expect(sortAccountingRows(rows, "asc", (row) => row.amount).map((row) => row.amount)).toEqual([
      -25, 2, 10,
    ]);
    expect(sortAccountingRows(rows, "desc", (row) => row.amount).map((row) => row.amount)).toEqual([
      10, 2, -25,
    ]);
    expect(rows.map((row) => row.amount)).toEqual([10, -25, 2]);
  });
});
