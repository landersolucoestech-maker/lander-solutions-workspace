import { createFileRoute } from "@tanstack/react-router";

import { LeadServicesSettingsPage } from "@/modules/commercial/crm/lead-services-settings-page";

export const Route = createFileRoute("/configuracoes-servicos-leads")({
  head: () => ({
    meta: [
      {
        title: "Configuração de serviços dos leads | Sistema Central Lander Solutions",
      },
      {
        name: "description",
        content: "Configuração interna do catálogo de serviços utilizado no formulário de Leads.",
      },
    ],
  }),
  component: LeadServicesSettingsPage,
});
