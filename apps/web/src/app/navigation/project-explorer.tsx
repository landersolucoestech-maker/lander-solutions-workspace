import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Map } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const sections = [
  {
    label: "Principal",
    items: [
      ["Dashboard", "/"],
      ["Agenda", "/agenda"],
      ["CRM", "/crm"],
      ["Contratos", "/contratos"],
      ["Atendimento e Suporte", "/atendimento"],
      ["Relatórios", "/relatorios"],
      ["Recursos Humanos", "/rh"],
    ],
  },
  {
    label: "Financeiro",
    items: [
      ["Transações", "/transacoes"],
      ["Contabilidade", "/contabilidade"],
      ["Notas Fiscais", "/nota-fiscal"],
      ["Rateio de Custos", "/rateio"],
      ["Repasses", "/repasses"],
      ["Participações Contratuais", "/participacoes"],
    ],
  },
  {
    label: "Governança",
    items: [
      ["Jurídico", "/juridico"],
      ["Compliance e Políticas", "/compliance-politicas"],
      ["Propriedade Intelectual", "/propriedade-intelectual"],
    ],
  },
  {
    label: "Administração",
    items: [
      ["Produtos / Unidades", "/unidades"],
      ["Estrutura Organizacional", "/estrutura-organizacional"],
      ["Estrutura Societária", "/estrutura-societaria"],
      ["Patrimônio e Licenças", "/patrimonio-licencas"],
      ["Acessos e Permissões", "/acessos"],
      ["Auditoria", "/auditoria"],
      ["Integrações", "/configuracoes/integracoes"],
    ],
  },
  {
    label: "Configurações internas",
    items: [
      ["Serviços de Leads", "/configuracoes-servicos-leads"],
      ["Templates de Contratos", "/configuracoes-templates-contratos"],
      ["Variáveis de Contratos", "/configuracoes-variaveis-contratos"],
    ],
  },
] as const;

export function ProjectExplorer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-2">
          <Map className="h-4 w-4" />
          Explorar projeto
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
        {sections.map((section, index) => (
          <div key={section.label}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
            {section.items.map(([label, to]) => (
              <DropdownMenuItem key={to} asChild>
                <Link
                  to={to}
                  className="flex w-full items-center justify-between"
                  aria-current={pathname === to ? "page" : undefined}
                >
                  <span>{label}</span>
                  {pathname === to && <span className="text-xs text-muted-foreground">Atual</span>}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
