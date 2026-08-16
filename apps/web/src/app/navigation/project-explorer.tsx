import { useNavigate, useRouterState } from "@tanstack/react-router";
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
    label: "Visão geral",
    items: [
      ["Dashboard", "/"],
      ["Agenda", "/agenda"],
    ],
  },
  {
    label: "Empresa e Comercial",
    items: [
      ["CRM", "/crm"],
      ["Clientes", "/clientes"],
      ["Produtos / Unidades", "/unidades"],
      ["Estrutura Corporativa", "/estrutura"],
      ["Estrutura Organizacional", "/estrutura-organizacional"],
      ["Estrutura Societária", "/estrutura-societaria"],
      ["Ativos Corporativos", "/ativos"],
      ["Patrimônio e Licenças", "/patrimonio-licencas"],
    ],
  },
  {
    label: "Contratos e Operação",
    items: [
      ["Contratos", "/contratos"],
      ["Atendimento e Suporte", "/atendimento"],
      ["Recursos Humanos", "/rh"],
    ],
  },
  {
    label: "Financeiro e Fiscal",
    items: [
      ["Transações", "/transacoes"],
      ["Contabilidade", "/contabilidade"],
      ["Notas Fiscais", "/nota-fiscal"],
      ["Rateio de Custos", "/rateio"],
      ["Participações", "/participacoes"],
      ["Repasses", "/repasses"],
      ["Relatórios", "/relatorios"],
    ],
  },
  {
    label: "Governança",
    items: [
      ["Jurídico", "/juridico"],
      ["Compliance e Políticas", "/compliance-politicas"],
      ["Propriedade Intelectual", "/propriedade-intelectual"],
      ["Acessos e Permissões", "/acessos"],
      ["Auditoria", "/auditoria"],
    ],
  },
  {
    label: "Integrações e Configurações",
    items: [
      ["Integrações", "/integracoes"],
      ["Configurações de Integrações", "/configuracoes/integracoes"],
      ["Serviços de Leads", "/configuracoes-servicos-leads"],
      ["Templates de Contratos", "/configuracoes-templates-contratos"],
      ["Variáveis de Contratos", "/configuracoes-variaveis-contratos"],
    ],
  },
] as const;

export function ProjectExplorer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-2">
          <Map className="h-4 w-4" />
          Explorar páginas
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[78vh] w-80 overflow-y-auto">
        {sections.map((section, index) => (
          <div key={section.label}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
            {section.items.map(([label, to]) => (
              <DropdownMenuItem
                key={to}
                onSelect={() => void navigate({ to })}
                className="flex w-full cursor-pointer items-center justify-between"
              >
                <span>{label}</span>
                {pathname === to && <span className="text-xs text-muted-foreground">Atual</span>}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
