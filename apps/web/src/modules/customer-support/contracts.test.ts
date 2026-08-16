import { describe, expect, it } from "vitest";
import {
  SUPPORT_ACTIONS,
  parseSupportApiEnvelope,
  SupportApiError,
  type SupportActionRequest,
  type SupportActionResponse,
} from "./contracts";

const inboxRequest = {
  action: "list-inbox",
  productId: "00000000-0000-4000-8000-000000000001",
  status: "waiting_for_agent",
  priority: "high",
  unassigned: true,
} satisfies SupportActionRequest<"list-inbox">;

const publishRequest = {
  action: "publish-automation",
  versionId: "00000000-0000-4000-8000-000000000002",
  expectedVersion: 4,
} satisfies SupportActionRequest<"publish-automation">;

const publishResponse: SupportActionResponse<"publish-automation"> = {
  valid: true,
  publishedVersionId: publishRequest.versionId,
};

describe("customer operations contracts", () => {
  it("exposes every backend action exactly once", () => {
    expect(SUPPORT_ACTIONS).toHaveLength(36);
    expect(new Set(SUPPORT_ACTIONS).size).toBe(SUPPORT_ACTIONS.length);
    expect(SUPPORT_ACTIONS).toContain(inboxRequest.action);
    expect(SUPPORT_ACTIONS).toContain(publishRequest.action);
  });

  it("parses a typed success envelope", () => {
    const result = parseSupportApiEnvelope("publish-automation", {
      result: publishResponse,
      requestId: "request-123",
    });

    expect(result.valid).toBe(true);
    expect(result.publishedVersionId).toBe(publishRequest.versionId);
  });

  it("preserves structured backend errors", () => {
    expect.assertions(3);

    try {
      parseSupportApiEnvelope("save-queue", {
        error: "Fila alterada por outro usuário.",
        code: "conflict",
        requestId: "request-conflict",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SupportApiError);
      expect((error as SupportApiError).code).toBe("conflict");
      expect((error as SupportApiError).requestId).toBe("request-conflict");
    }
  });

  it("rejects malformed envelopes instead of returning fallback data", () => {
    expect(() =>
      parseSupportApiEnvelope("list-products", { requestId: "request-invalid" }),
    ).toThrow("não contém resultado");
  });
});
