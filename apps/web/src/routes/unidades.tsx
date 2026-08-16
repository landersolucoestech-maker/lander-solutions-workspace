import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";

import { BusinessUnitsPage } from "@/modules/company/organizational-structure/business-units";

export const Route = createFileRoute("/unidades")({
  component: UnitsRoute,
});

function UnitsRoute() {
  const location = useLocation();
  return location.pathname === "/unidades" ? <BusinessUnitsPage /> : <Outlet />;
}
