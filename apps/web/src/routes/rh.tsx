import { createFileRoute } from "@tanstack/react-router";

import { HrPage } from "@/modules/company/hr/hr-page";

export const Route = createFileRoute("/rh")({
  head: () => ({
    meta: [
      { title: "Recursos Humanos | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Gestão corporativa de colaboradores, vínculos, documentos, ausências, pagamentos administrativos, onboarding, desligamentos, equipamentos e acessos.",
      },
      { property: "og:title", content: "Recursos Humanos | Lander Solutions" },
      {
        property: "og:description",
        content: "Módulo corporativo de RH com RLS, MFA, auditoria e segregação de funções.",
      },
    ],
  }),
  component: HrPage,
});
