import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/estrutura")({
  beforeLoad: () => {
    throw redirect({ to: "/estrutura-organizacional", replace: true });
  },
});
