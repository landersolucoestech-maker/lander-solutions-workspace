import { createFileRoute } from "@tanstack/react-router";

import { AllocationPage } from "@/modules/finance/allocations";

export const Route = createFileRoute("/rateio")({
  component: AllocationPage,
});
