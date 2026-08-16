import { createFileRoute } from "@tanstack/react-router";

import { FiscalPage } from "@/modules/finance/fiscal/fiscal-page";

export const Route = createFileRoute("/nota-fiscal")({
  head: () => ({
    meta: [
      { title: "Nota Fiscal | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Página exclusiva para cadastrar, consultar e administrar notas fiscais de entrada e saída da LANDER SOLUTIONS.",
      },
    ],
  }),
  component: FiscalPage,
});
