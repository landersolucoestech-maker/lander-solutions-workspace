import { describe, expect, it } from "vitest";

import { nextFiscalSort, sortFiscalRows } from "./table-sorting";

describe("fiscal table sorting", () => {
  it("toggles the active column and starts a new column ascending", () => {
    expect(nextFiscalSort({ key: "note", direction: "asc" }, "note")).toEqual({
      key: "note",
      direction: "desc",
    });
    expect(nextFiscalSort({ key: "note", direction: "desc" }, "issuedAt")).toEqual({
      key: "issuedAt",
      direction: "asc",
    });
  });

  it("sorts textual identifiers and displayed labels", () => {
    const rows = [
      { number: "2", operation: "Saída" },
      { number: "10", operation: "Entrada" },
      { number: "1", operation: "Saída" },
    ];
    expect(sortFiscalRows(rows, "asc", (row) => row.number).map((row) => row.number)).toEqual([
      "1",
      "10",
      "2",
    ]);
    expect(sortFiscalRows(rows, "asc", (row) => row.operation).map((row) => row.operation)).toEqual(
      ["Entrada", "Saída", "Saída"],
    );
  });

  it("sorts timestamps and signed monetary values numerically", () => {
    const rows = [
      { issuedAt: "2026-08-12T12:00:00Z", value: 10 },
      { issuedAt: "2026-08-11T12:00:00Z", value: -25 },
      { issuedAt: null, value: 2 },
    ];
    expect(sortFiscalRows(rows, "asc", (row) => row.value).map((row) => row.value)).toEqual([
      -25, 2, 10,
    ]);
    expect(
      sortFiscalRows(rows, "desc", (row) => (row.issuedAt ? Date.parse(row.issuedAt) : null)).map(
        (row) => row.issuedAt,
      ),
    ).toEqual(["2026-08-12T12:00:00Z", "2026-08-11T12:00:00Z", null]);
  });

  it("does not mutate the filtered source collection", () => {
    const rows = [{ value: 2 }, { value: 1 }];
    sortFiscalRows(rows, "asc", (row) => row.value);
    expect(rows.map((row) => row.value)).toEqual([2, 1]);
  });
});
