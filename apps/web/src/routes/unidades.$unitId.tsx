import { createFileRoute } from "@tanstack/react-router";

import { BusinessUnitDetailPage } from "@/modules/company/organizational-structure/business-units/business-unit-detail-page";

export const Route = createFileRoute("/unidades/$unitId")({
  component: UnitDetailRoute,
});

function UnitDetailRoute() {
  const { unitId } = Route.useParams();
  return <BusinessUnitDetailPage unitId={unitId} />;
}
