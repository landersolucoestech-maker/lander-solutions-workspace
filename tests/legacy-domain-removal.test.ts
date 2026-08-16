import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const resolve = (relative: string) => path.join(root, relative);
const read = (relative: string) => readFileSync(resolve(relative), "utf8");

describe("legacy equipment and legal domain removal", () => {
  const requiredFiles = [
    "supabase/migrations/20260805045000_drop_legacy_equipment_and_legal_tables.sql",
    "supabase/migrations/20260805045500_drop_legacy_hr_equipment_routines.sql",
    "supabase/tests/database/legacy-domain-removal.test.sql",
  ];

  it.each(requiredFiles)("keeps the required artifact %s", (relative) => {
    expect(existsSync(resolve(relative))).toBe(true);
  });

  it("keeps admin-hr detached from the migrated equipment ledger", () => {
    const source = read("supabase/functions/admin-hr/index.ts");
    const forbidden = [
      'case "create-equipment"',
      'case "assign-equipment"',
      'case "return-equipment"',
      '.from("equipment")',
      '.from("equipment_assignments")',
      "admin_assign_hr_equipment",
      "admin_create_hr_equipment",
      "admin_return_hr_equipment",
      "hr.equipment.read",
      "hr.equipment.manage",
    ];

    for (const fragment of forbidden) expect(source).not.toContain(fragment);
  });

  it("keeps the table removal migration restrictive and explicit", () => {
    const source = read(
      "supabase/migrations/20260805045000_drop_legacy_equipment_and_legal_tables.sql",
    ).toLowerCase();

    for (const fragment of [
      "drop policy if exists equipment_select_hr",
      "drop table if exists public.equipment_assignments restrict",
      "drop table if exists public.equipment restrict",
      "drop table if exists public.legal_cases restrict",
    ]) {
      expect(source).toContain(fragment);
    }
    expect(source).not.toContain("cascade");
  });

  it("keeps the obsolete HR routines and permissions removed", () => {
    const source = read(
      "supabase/migrations/20260805045500_drop_legacy_hr_equipment_routines.sql",
    ).toLowerCase();

    for (const fragment of [
      "drop function if exists public.admin_assign_hr_equipment",
      "drop function if exists public.admin_create_hr_equipment",
      "drop function if exists public.admin_return_hr_equipment",
      "drop function if exists private.block_legacy_equipment_write",
      "delete from public.permissions",
      "hr.equipment.read",
      "hr.equipment.manage",
    ]) {
      expect(source).toContain(fragment);
    }
  });
});
