import { useRouterState } from "@tanstack/react-router";

import { FrontendPreviewPage } from "@/app/preview/frontend-preview-page";
import { UnitDetailPreview } from "@/app/preview/unit-detail-preview";

export function FrontendPreviewRouter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/unidades/") && pathname !== "/unidades") {
    return <UnitDetailPreview />;
  }
  return <FrontendPreviewPage />;
}
