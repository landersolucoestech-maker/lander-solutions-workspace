import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("intellectual-property authorization boundary", () => {
  it("uses the PI manage permission in the frontend", () => {
    const page = read(
      "src/modules/governance/intellectual-property/intellectual-property-page.tsx",
    );
    expect(page).toContain('hasPermission("ip.read")');
    expect(page).toContain('hasPermission("ip.manage")');
    expect(page).toContain('hasPermission("ip.approve")');
    expect(page).not.toContain('hasPermission("legal.manage")');
  });

  it("uses ip.approve for the existing approval Edge actions", () => {
    const api = read("src/modules/governance/intellectual-property/api.ts");
    const edge = read("../../supabase/functions/admin-intellectual-property/index.ts");
    expect(api).toContain('action: approve ? "approve-ip-event" : "reject-ip-event"');
    expect(api).toContain('functions.invoke("admin-intellectual-property"');
    expect(api).not.toContain("admin-governance");
    expect(edge).toContain('"approve-ip-event": "ip.approve"');
    expect(edge).toContain('"reject-ip-event": "ip.approve"');
  });

  it("keeps Legal authorization outside the PI Edge Function", () => {
    const edge = read("../../supabase/functions/admin-intellectual-property/index.ts");
    expect(edge).not.toContain("legal.manage");
    expect(edge).not.toContain("legal.close");
    expect(edge).not.toContain("legal_matters");
  });
});
