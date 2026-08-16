import { useRouterState } from "@tanstack/react-router";

import { FrontendPreviewPage } from "@/app/preview/frontend-preview-page";
import { UnitDetailPreview } from "@/app/preview/unit-detail-preview";
import { UnitsPreview } from "@/app/preview/units-preview";

export function FrontendPreviewRouter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/unidades") return <UnitsPreview />;
  if (pathname.startsWith("/unidades/")) return <UnitDetailPreview />;
  return <FrontendPreviewPage />;
}
