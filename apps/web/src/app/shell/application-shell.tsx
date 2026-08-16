import { Outlet } from "@tanstack/react-router";

import { AppSidebar } from "@/app/navigation/app-sidebar";
import { ProjectExplorer } from "@/app/navigation/project-explorer";
import { Topbar } from "@/app/navigation/topbar";
import { WorkspaceProvider } from "@/app/providers/workspace-context";
import { LegacyRowActionsBridge } from "@/app/shell/legacy-row-actions-bridge";
import { SidebarProvider } from "@/shared/components/ui/sidebar";

export function ApplicationShell() {
  return (
    <>
      <LegacyRowActionsBridge />
      <WorkspaceProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <div className="flex justify-end border-b bg-muted/30 px-4 py-2 md:px-6">
                <ProjectExplorer />
              </div>
              <main className="min-w-0 flex-1 space-y-6 overflow-x-hidden p-4 md:p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </WorkspaceProvider>
    </>
  );
}
