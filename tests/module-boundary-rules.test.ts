import { describe, expect, it } from "vitest";

import {
  aggregateFacadeViolations,
  featureRouteViolations,
  misplacedBusinessFiles,
  modulesToFeaturesViolations,
  reverseBarrelViolations,
  singleDomainSharedViolations,
} from "../scripts/module-boundary-rules.ts";

describe("module boundary rules", () => {
  it("rejects modules importing legacy features", () => {
    expect(
      modulesToFeaturesViolations([
        {
          path: "apps/web/src/modules/contracts/page.tsx",
          content: 'import { directory } from "@/features/corporate/api";',
        },
      ]),
    ).toHaveLength(1);
  });

  it("rejects routes backed by business features", () => {
    expect(
      featureRouteViolations([
        {
          path: "apps/web/src/routes/crm.tsx",
          content: 'import { CrmPage } from "@/features/crm";',
        },
      ]),
    ).toHaveLength(1);
  });

  it("rejects reverse compatibility barrels", () => {
    expect(
      reverseBarrelViolations([
        {
          path: "apps/web/src/features/financial-operations/api.ts",
          content: 'export { listOperations } from "@/modules/finance/transactions";',
        },
      ]),
    ).toHaveLength(1);
  });

  it("accepts module-to-module dependencies", () => {
    const sources = [
      {
        path: "apps/web/src/modules/commercial/crm/page.tsx",
        content: 'import { listParties } from "@/modules/parties";',
      },
    ];
    expect(modulesToFeaturesViolations(sources)).toEqual([]);
    expect(reverseBarrelViolations(sources)).toEqual([]);
  });

  it("rejects business files in global components and lib", () => {
    expect(
      misplacedBusinessFiles([
        {
          path: "apps/web/src/components/payout-editor.tsx",
          content: 'import { pay } from "@/modules/finance/payouts";',
        },
      ]),
    ).toHaveLength(1);
  });

  it("rejects aggregate facades even after a physical move", () => {
    expect(
      aggregateFacadeViolations([
        {
          path: "apps/web/src/modules/company/corporate-directory/api.ts",
          content: "export const list = () => [];",
        },
      ]),
    ).toHaveLength(1);
  });

  it("rejects domain-owned code parked in shared", () => {
    const sources = [
      {
        path: "apps/web/src/shared/support-queues.ts",
        content: 'import type { Queue } from "@/modules/customer-support/types";',
      },
      {
        path: "apps/web/src/modules/customer-support/page.tsx",
        content: 'import { queues } from "@/shared/support-queues";',
      },
    ];
    expect(singleDomainSharedViolations(sources)).toHaveLength(1);
  });
});
