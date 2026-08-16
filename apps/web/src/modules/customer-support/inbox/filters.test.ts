import { describe, expect, it } from "vitest";
import { emptySupportInboxFilters, type SupportInboxFilterState } from "./filters";

function buildBackendPayload(filters: SupportInboxFilterState) {
  return {
    search: filters.search.trim() || undefined,
    queueId: filters.queueId || undefined,
    agentUserId: filters.agentUserId || undefined,
    channelId: filters.channelId || undefined,
    categoryId: filters.categoryId || undefined,
    slaPolicyId: filters.slaPolicyId || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    slaState: filters.slaState || undefined,
    unassigned: filters.unassigned || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

describe("support inbox filters", () => {
  it("starts without silently restricting the inbox", () => {
    expect(buildBackendPayload(emptySupportInboxFilters)).toEqual({
      search: undefined,
      queueId: undefined,
      agentUserId: undefined,
      channelId: undefined,
      categoryId: undefined,
      slaPolicyId: undefined,
      status: undefined,
      priority: undefined,
      slaState: undefined,
      unassigned: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it("preserves combined operational filters", () => {
    const filters: SupportInboxFilterState = {
      ...emptySupportInboxFilters,
      search: "  cobrança  ",
      queueId: "queue-id",
      status: "waiting_for_agent",
      priority: "urgent",
      slaState: "breached",
      unassigned: true,
      dateFrom: "2026-08-01T00:00",
      dateTo: "2026-08-04T23:59",
    };

    expect(buildBackendPayload(filters)).toMatchObject({
      search: "cobrança",
      queueId: "queue-id",
      status: "waiting_for_agent",
      priority: "urgent",
      slaState: "breached",
      unassigned: true,
    });
  });
});
