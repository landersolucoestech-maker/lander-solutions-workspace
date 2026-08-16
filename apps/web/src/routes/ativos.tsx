import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ativos")({
  beforeLoad: () => {
    throw redirect({ to: "/patrimonio-licencas", replace: true });
  },
});
