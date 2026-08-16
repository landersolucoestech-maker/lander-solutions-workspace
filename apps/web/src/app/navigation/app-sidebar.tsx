import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ContactRound,
  FileSignature,
  Headphones,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Network,
  PackageSearch,
  Percent,
  ReceiptText,
  Scale,
  Server,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
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

const coreItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
] as const;

const groups = [
  {
    title: "Empresa",
    icon: Building2,
    items: [
      { title: "Cadastros da Empresa", url: "/estrutura-organizacional", icon: Building2 },
      { title: "Estrutura Corporativa", url: "/estrutura", icon: Building2 },
      { title: "Estrutura Societária", url: "/estrutura-societaria", icon: Landmark },
      { title: "Acessos e Permissões", url: "/acessos", icon: KeyRound },
    ],
  },
  {
    title: "Comercial",
    icon: ContactRound,
    items: [
      { title: "CRM", url: "/crm", icon: ContactRound },
      { title: "Produtos / Unidades", url: "/unidades", icon: PackageSearch },
    ],
  },
  {
    title: "Operações",
    icon: Settings,
    items: [
      { title: "Agenda Corporativa", url: "/agenda", icon: CalendarDays },
      { title: "Ativos Corporativos", url: "/ativos", icon: Server },
      { title: "Patrimônio e Licenças", url: "/patrimonio-licencas", icon: Server },
    ],
  },
  {
    title: "Contratos",
    icon: FileSignature,
    items: [{ title: "Gestão de Contratos", url: "/contratos", icon: FileSignature }],
  },
  {
    title: "Financeiro",
    icon: CircleDollarSign,
    items: [
      { title: "Transações", url: "/transacoes", icon: WalletCards },
      { title: "Contabilidade", url: "/contabilidade", icon: BarChart3 },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    title: "Fiscal",
    icon: ReceiptText,
    items: [{ title: "Notas Fiscais", url: "/nota-fiscal", icon: ReceiptText }],
  },
  {
    title: "Custos & Rateios",
    icon: Scale,
    items: [{ title: "Rateio de Custos", url: "/rateio", icon: Scale }],
  },
  {
    title: "Participações & Repasses",
    icon: Percent,
    items: [
      { title: "Participações", url: "/participacoes", icon: Percent },
      { title: "Repasses", url: "/repasses", icon: WalletCards },
    ],
  },
  {
    title: "Atendimento",
    icon: Headphones,
    items: [{ title: "Atendimento e Suporte", url: "/atendimento", icon: Headphones }],
  },
  {
    title: "Governança",
    icon: ShieldCheck,
    items: [
      { title: "Jurídico", url: "/juridico", icon: Scale },
      { title: "Compliance e Políticas", url: "/compliance-politicas", icon: ShieldCheck },
      { title: "Propriedade Intelectual", url: "/propriedade-intelectual", icon: ShieldCheck },
      { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
    ],
  },
  {
    title: "Gestão e Configurações",
    icon: Settings,
    items: [
      { title: "Recursos Humanos", url: "/rh", icon: UsersRound },
      { title: "Integrações", url: "/integracoes", icon: Network },
      {
        title: "Configurações de Integrações",
        url: "/configuracoes/integracoes",
        icon: Settings,
      },
      { title: "Serviços de Leads", url: "/configuracoes-servicos-leads", icon: Settings },
      {
        title: "Templates de Contratos",
        url: "/configuracoes-templates-contratos",
        icon: FileSignature,
      },
      {
        title: "Variáveis de Contratos",
        url: "/configuracoes-variaveis-contratos",
        icon: FileSignature,
      },
    ],
  },
] as const;

function LanderMark() {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B6A4F] text-[14px] font-black tracking-[-0.12em] text-white shadow-sm"
      aria-label="Lander Solutions"
    >
      LS
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const renderItem = (
    item: {
      title: string;
      url: string;
      icon: typeof LayoutDashboard;
      exact?: boolean;
    },
    nested = false,
  ) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url, item.exact)}
        tooltip={item.title}
        className={nested && !collapsed ? "pl-7" : undefined}
      >
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
        <Link
          to="/"
          className="flex items-center gap-3 px-1.5 py-2.5"
          aria-label="Ir para o Dashboard"
        >
          <LanderMark />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-[Poppins] text-[13px] font-semibold tracking-[.12em] text-white">
                LANDER
              </p>
              <p className="truncate text-[9px] font-semibold tracking-[.32em] text-[#55A78E]">
                SOLUTIONS
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => renderItem(item))}
              {!collapsed && (
                <li className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.16em] text-sidebar-foreground/45">
                  Sistema completo
                </li>
              )}
              {groups.map((group) => {
                const groupTarget = group.items[0];
                return (
                  <div key={group.title}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={group.items.some((item) => isActive(item.url))}
                        tooltip={group.title}
                      >
                        <Link to={groupTarget.url} className="flex items-center gap-2">
                          <group.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <span className="truncate text-[13px] font-semibold">
                              {group.title}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {group.items.map((item) => renderItem(item, true))}
                  </div>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="px-2 py-2">
            <p className="text-[11px] font-medium text-sidebar-foreground/75">
              Lander Solutions Ltda.
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-sidebar-foreground/50">
              Tecnologia para empresas crescerem.
            </p>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
