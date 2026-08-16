import { createFileRoute } from "@tanstack/react-router";

import { IntellectualPropertyPage } from "@/modules/governance/intellectual-property";

export const Route = createFileRoute("/propriedade-intelectual")({
  component: IntellectualPropertyPage,
});
