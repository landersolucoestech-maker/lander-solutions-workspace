import { createFileRoute } from "@tanstack/react-router";

import { AgendaPage } from "@/modules/scheduling/agenda";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda corporativa | Lander Solutions" },
      {
        name: "description",
        content: "Eventos corporativos com escopo, participantes e vínculos aos cadastros mestres.",
      },
    ],
  }),
  component: AgendaPage,
});
