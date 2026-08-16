import { describe, expect, it } from "vitest";

import { nextTableSort, sortTableRows } from "./table-sorting";

describe("CRM table sorting", () => {
  it("starts a newly selected column in ascending order and toggles it", () => {
    const first = nextTableSort(null, "name");
    expect(first).toEqual({ key: "name", direction: "asc" });
    expect(nextTableSort(first, "name")).toEqual({ key: "name", direction: "desc" });
    expect(nextTableSort({ key: "name", direction: "desc" }, "date")).toEqual({
      key: "date",
      direction: "asc",
    });
  });

  it("sorts displayed text using Brazilian collation without mutating the source", () => {
    const rows = [{ name: "Zulu" }, { name: "Álvaro" }, { name: "Ana" }];
    expect(sortTableRows(rows, "asc", (row) => row.name).map((row) => row.name)).toEqual([
      "Álvaro",
      "Ana",
      "Zulu",
    ]);
    expect(sortTableRows(rows, "desc", (row) => row.name).map((row) => row.name)).toEqual([
      "Zulu",
      "Ana",
      "Álvaro",
    ]);
    expect(rows.map((row) => row.name)).toEqual(["Zulu", "Álvaro", "Ana"]);
  });

  it("sorts numeric and temporal values as numbers", () => {
    const rows = [
      { amount: 10, sentAt: "2026-08-12T12:00:00Z" },
      { amount: 2, sentAt: "2026-08-11T12:00:00Z" },
    ];
    expect(sortTableRows(rows, "asc", (row) => row.amount)[0]?.amount).toBe(2);
    expect(sortTableRows(rows, "asc", (row) => Date.parse(row.sentAt))[0]?.sentAt).toBe(
      "2026-08-11T12:00:00Z",
    );
    expect(sortTableRows(rows, "desc", (row) => Date.parse(row.sentAt))[0]?.sentAt).toBe(
      "2026-08-12T12:00:00Z",
    );
  });

  it("preserves source order when values are equal", () => {
    const rows = [
      { id: "first", status: "Ativo" },
      { id: "second", status: "Ativo" },
    ];
    expect(sortTableRows(rows, "asc", (row) => row.status).map((row) => row.id)).toEqual([
      "first",
      "second",
    ]);
  });
});
