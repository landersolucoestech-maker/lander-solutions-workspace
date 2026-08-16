import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Payout authorization boundary", () => {
  it("uses the singular canonical permission family", () => {
    const page = read("src/modules/finance/payouts/payouts-page.tsx");
    const edge = read("../../supabase/functions/admin-payouts/index.ts");
    for (const permission of ["read", "manage", "post"]) {
      expect(page).toContain(`hasPermission("payout.${permission}")`);
    }
    expect(edge).toContain('"payout.read"');
    expect(edge).toContain('"payout.post"');
    expect(`${page}\n${edge}`).not.toMatch(/payouts\.(read|manage|approve|pay|reverse)/);
  });

  it("uses caller-scoped payout RPCs", () => {
    const edge = read("../../supabase/functions/admin-payouts/index.ts");
    expect(edge).toContain('client.rpc("post_payout_payment"');
    expect(edge).toContain('client.rpc("list_available_payout_settlements"');
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).not.toContain("admin_post_payout_payment");
  });

  it("explains the financial progression from due to paid and pending", () => {
    const page = read("src/modules/finance/payouts/payouts-page.tsx");
    expect(page).toContain('label="Total devido"');
    expect(page).toContain('label="Total pago"');
    expect(page).toContain('label="Saldo pendente"');
    expect(page).toContain("PayoutTimelineDialog");
    expect(page).toContain("participation_calculation_id");
  });
});
