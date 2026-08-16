import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Participation ownership boundary", () => {
  it("uses the singular permission family and caller-scoped workflows", () => {
    const page = read("src/modules/finance/participations/participations-page.tsx");
    const edge = read("../../supabase/functions/admin-participations/index.ts");
    for (const permission of ["read", "manage", "approve", "post"]) {
      expect(page).toContain(`hasPermission("participation.${permission}")`);
    }
    expect(`${page}\n${edge}`).not.toMatch(/participations\.(read|manage|approve)/);
    for (const rpc of [
      "calculate_participation",
      "submit_participation",
      "decide_participation",
      "post_participation",
    ]) {
      expect(edge).toContain(`client.rpc("${rpc}"`);
    }
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("consumes Contracts only as a versioned input and does not own payouts", () => {
    const api = read("src/modules/finance/participations/api.ts");
    expect(api).toContain('from("contracts")');
    expect(api).toContain('from("contract_versions")');
    expect(api).not.toContain('from("payout_obligations")');
    expect(api).not.toContain('from("payout_payments")');
  });
});
