import { Outlet, useRouterState } from "@tanstack/react-router";

import { DashboardPreview } from "@/app/preview/dashboard-preview";
import { FrontendPreviewPage } from "@/app/preview/frontend-preview-page";
import { UnitDetailPreview } from "@/app/preview/unit-detail-preview";
import { UnitsPreview } from "@/app/preview/units-preview";

export function FrontendPreviewRouter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/") return <DashboardPreview />;
  if (pathname === "/agenda") return <Outlet />;
  if (pathname === "/unidades") return <UnitsPreview />;
  if (pathname.startsWith("/unidades/")) return <UnitDetailPreview />;
  return <FrontendPreviewPage />;
}
