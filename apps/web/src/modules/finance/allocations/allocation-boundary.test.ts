import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Allocation workflow boundary", () => {
  it("uses all five allocation permissions in the frontend", () => {
    const page = read("src/modules/finance/allocations/allocation-page.tsx");
    for (const permission of ["read", "manage", "approve", "post", "reverse"]) {
      expect(page).toContain(`hasPermission("allocation.${permission}")`);
    }
  });

  it("delegates every workflow operation to the caller-scoped dispatcher", () => {
    const edge = read("../../supabase/functions/admin-allocations/index.ts");
    expect(edge).toContain('callerClient.rpc("run_allocation_workflow"');
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).not.toMatch(/\.rpc\("admin_/);
  });

  it("keeps post and reverse actions distinct from approval", () => {
    const edge = read("../../supabase/functions/admin-allocations/index.ts");
    expect(edge).toContain('"post-run": "post-run"');
    expect(edge).toContain('"reverse-run": "reverse-run"');
    expect(edge).not.toContain('"post-run": "allocation.approve"');
    expect(edge).not.toContain('"reverse-run": "allocation.approve"');
  });

  it("offers a simple expense-first layer without bypassing approval", () => {
    const simple = read("src/modules/finance/allocations/simple-allocation-panel.tsx");
    expect(simple).toContain("Qual despesa?");
    expect(simple).toContain("Quais unidades se beneficiam?");
    expect(simple).toContain('"equal"');
    expect(simple).toContain('"fixed_percentage"');
    expect(simple).toContain("submitAllocationVersion");
    expect(simple).not.toContain("post-run");
  });
});
