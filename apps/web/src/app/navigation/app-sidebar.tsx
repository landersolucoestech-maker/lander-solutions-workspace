import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ContactRound,
  Copyright,
  FileSignature,
  GitBranch,
  Headphones,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Network,
  Percent,
  ReceiptText,
  Scale,
  Server,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/components/ui/sidebar";

const beforeFinanceItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "CRM", url: "/crm", icon: ContactRound },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
];

const financeItems = [
  { title: "Transações", url: "/transacoes", icon: WalletCards },
  { title: "Contabilidade", url: "/contabilidade", icon: BarChart3 },
  { title: "Nota Fiscal", url: "/nota-fiscal", icon: ReceiptText },
  { title: "Rateio de Custos", url: "/rateio", icon: GitBranch },
  { title: "Repasses", url: "/repasses", icon: WalletCards },
];

const afterFinanceItems = [
  { title: "Participações Contratuais", url: "/participacoes", icon: Percent },
  { title: "Atendimento e Suporte", url: "/atendimento", icon: Headphones },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Recursos Humanos", url: "/rh", icon: UsersRound },
];

const governanceItems = [
  { title: "Jurídico", url: "/juridico", icon: Scale },
  { title: "Compliance e Políticas", url: "/compliance-politicas", icon: ShieldCheck },
  { title: "Propriedade Intelectual", url: "/propriedade-intelectual", icon: Copyright },
];

const administrationItems = [
  { title: "Produtos / Unidades", url: "/unidades", icon: Building2 },
  { title: "Estrutura Organizacional", url: "/estrutura-organizacional", icon: Building2 },
  { title: "Estrutura Societária", url: "/estrutura-societaria", icon: Landmark },
  { title: "Patrimônio e Licenças", url: "/patrimonio-licencas", icon: Server },
  { title: "Acessos e Permissões", url: "/acessos", icon: KeyRound },
  { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
  { title: "Integrações", url: "/configuracoes/integracoes", icon: Network },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const financeActive = financeItems.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
  const governanceActive = governanceItems.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
  const administrationActive = administrationItems.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
  const [financeOpen, setFinanceOpen] = useState(true);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [administrationOpen, setAdministrationOpen] = useState(false);
  const financeExpanded = financeOpen || financeActive;
  const governanceExpanded = governanceOpen || governanceActive;
  const administrationExpanded = administrationOpen || administrationActive;

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const renderItem = (item: {
    title: string;
    url: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
  }) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
        <Link to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            LS
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                Lander Solutions
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/70">Gestão corporativa</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {beforeFinanceItems.map(renderItem)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={financeActive}
                  tooltip="Financeiro"
                  aria-expanded={financeExpanded}
                  onClick={() => setFinanceOpen((open) => !open)}
                >
                  <Landmark className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate text-[13px] font-medium">Financeiro</span>
                      {financeExpanded ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(collapsed || financeExpanded) &&
                financeItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={!collapsed ? "pl-7" : undefined}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

              {afterFinanceItems.map(renderItem)}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={governanceActive}
                  tooltip="Governança"
                  aria-expanded={governanceExpanded}
                  onClick={() => setGovernanceOpen((open) => !open)}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate text-[13px] font-medium">Governança</span>
                      {governanceExpanded ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(collapsed || governanceExpanded) &&
                governanceItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={!collapsed ? "pl-7" : undefined}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={administrationActive}
                  tooltip="Administração"
                  aria-expanded={administrationExpanded}
                  onClick={() => setAdministrationOpen((open) => !open)}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate text-[13px] font-medium">Administração</span>
                      {administrationExpanded ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(collapsed || administrationExpanded) &&
                administrationItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={!collapsed ? "pl-7" : undefined}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border">
          <p className="px-2 py-1.5 text-[11px] leading-relaxed text-sidebar-foreground/60">
            Ambiente de desenvolvimento
          </p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
