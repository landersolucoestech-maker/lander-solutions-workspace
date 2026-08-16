import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/app/providers/auth-context";
import { AuthGate } from "@/app/router/auth-gate";
import { AUTHENTICATION_ENABLED } from "@/config/authentication";

export function ApplicationProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {AUTHENTICATION_ENABLED ? <AuthGate>{children}</AuthGate> : children}
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
