import { describe, expect, it } from "vitest";

import { normalizeDevelopmentListReadResponse } from "./development-read-fallback";

const origin = "http://127.0.0.1:65421";

function denied() {
  return new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

describe("normalizeDevelopmentListReadResponse", () => {
  it("turns a denied development list read into an empty result", async () => {
    const response = await normalizeDevelopmentListReadResponse(
      `${origin}/rest/v1/business_units?select=*`,
      undefined,
      denied(),
      true,
      origin,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("does not change the response outside the explicit development mode", async () => {
    const original = denied();
    const response = await normalizeDevelopmentListReadResponse(
      `${origin}/rest/v1/business_units?select=*`,
      undefined,
      original,
      false,
      origin,
    );

    expect(response).toBe(original);
  });

  it("does not mask mutations or singular reads", async () => {
    const mutation = denied();
    const singular = denied();

    expect(
      await normalizeDevelopmentListReadResponse(
        `${origin}/rest/v1/business_units?select=*`,
        { method: "POST" },
        mutation,
        true,
        origin,
      ),
    ).toBe(mutation);
    expect(
      await normalizeDevelopmentListReadResponse(
        `${origin}/rest/v1/business_units?select=*`,
        { headers: { accept: "application/vnd.pgrst.object+json" } },
        singular,
        true,
        origin,
      ),
    ).toBe(singular);
  });
});
