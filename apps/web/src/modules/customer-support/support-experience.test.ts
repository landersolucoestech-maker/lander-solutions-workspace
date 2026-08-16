import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Lander support operational experience", () => {
  it("makes real conversations the primary workspace", () => {
    const page = read("src/modules/customer-support/support-page.tsx");
    const workspace = read("src/modules/customer-support/operation/support-workspace.tsx");

    expect(page).toContain('defaultValue="operation"');
    expect(page).toContain("SupportOperationalWorkspace");
    expect(page).toContain("Administração do atendimento");
    expect(workspace).toContain("Atendimentos");
    expect(workspace).toContain("Aguardando cliente");
    expect(workspace).toContain("SupportConversationPanel");
  });

  it("keeps Lander backend actions and excludes Music OS specific domains", () => {
    const conversation = read("src/modules/customer-support/inbox/conversation-sheet.tsx");
    const workspace = read("src/modules/customer-support/operation/support-workspace.tsx");

    for (const action of [
      "replySupportConversation",
      "addSupportConversationNote",
      "assignSupportConversation",
      "transitionSupportConversation",
      "createSupportTicket",
    ]) {
      expect(conversation).toContain(action);
    }
    expect(`${conversation}\n${workspace}`).not.toMatch(/createLead|createEvent|internal chat/i);
  });
});
