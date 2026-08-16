import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/integracoes")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/integracoes" });
  },
  component: () => null,
});
