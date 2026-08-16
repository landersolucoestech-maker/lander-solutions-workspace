import { createFileRoute } from "@tanstack/react-router";

import { accessRouteOptions } from "@/modules/access-control";

export const Route = createFileRoute("/acessos")({
  ...accessRouteOptions,
});
