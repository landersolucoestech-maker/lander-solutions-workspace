import { createFileRoute } from "@tanstack/react-router";

import { IntegrationsPage } from "@/modules/settings/integrations";

export const Route = createFileRoute("/configuracoes/integracoes")({
  head: () => ({
    meta: [
      { title: "Configurações de integrações | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Cadastro técnico mínimo de integrações concretas que fornecem fatos empresariais consolidados ao Sistema Central.",
      },
      { property: "og:title", content: "Configurações de integrações | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Integrações secundárias e controladas, sem replicar a administração operacional dos produtos.",
      },
    ],
  }),
  component: IntegrationsPage,
});
