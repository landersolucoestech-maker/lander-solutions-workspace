import { createFileRoute } from "@tanstack/react-router";

import { ParticipationsPage } from "@/modules/finance/participations";

export const Route = createFileRoute("/participacoes")({
  component: ParticipationsPage,
});
