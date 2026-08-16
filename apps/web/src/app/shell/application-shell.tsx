import { Outlet } from "@tanstack/react-router";

import { AppSidebar } from "@/app/navigation/app-sidebar";
import { Topbar } from "@/app/navigation/topbar";
import { FrontendPreviewPage } from "@/app/preview/frontend-preview-page";
import { WorkspaceProvider } from "@/app/providers/workspace-context";
import { LegacyRowActionsBridge } from "@/app/shell/legacy-row-actions-bridge";
import { SidebarProvider } from "@/shared/components/ui/sidebar";

const FRONTEND_PREVIEW = import.meta.env.VITE_FRONTEND_PREVIEW === "true";

export function ApplicationShell() {
  return (
    <>
      {!FRONTEND_PREVIEW && <LegacyRowActionsBridge />}
      <WorkspaceProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {!FRONTEND_PREVIEW && <Topbar />}
              <main className="w-full min-w-0 flex-1 space-y-6 overflow-x-hidden p-4 md:p-6">
                {FRONTEND_PREVIEW ? <FrontendPreviewPage /> : <Outlet />}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </WorkspaceProvider>
    </>
  );
}
