import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Braces,
  Download,
  FileSpreadsheet,
  FileUp,
  Landmark,
  LogOut,
  Plus,
  Printer,
  RefreshCw,
  Upload,
} from "lucide-react";

import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useWorkspace, type UnitFilter } from "@/app/providers/workspace-context";
import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { listWorkspaceOptions } from "@/shared/workspace/api";

interface PageHeaderConfig {
  title: string;
  subtitle: string;
}

const PAGE_HEADERS: Record<string, PageHeaderConfig> = {
  "/": { title: "DASHBOARD", subtitle: "Visão consolidada dos indicadores e operações da organização." },
  "/crm": { title: "CRM", subtitle: "Centralize relacionamentos e transforme oportunidades em negócios." },
  "/agenda": { title: "Agenda corporativa", subtitle: "Organize eventos, participantes e vínculos operacionais com escopo e auditoria." },
  "/rh": { title: "Recursos Humanos", subtitle: "Gerencie pessoas, vínculos, contratos, documentos, ausências, pagamentos administrativos, onboarding, desligamentos, equipamentos e acessos, com RLS e auditoria." },
  "/atendimento": { title: "Atendimento e Suporte", subtitle: "Atendimento corporativo administrado pela Lander Solutions, com filas, conversas, tickets, automações e SLA por produto quando aplicável." },
  "/transacoes": { title: "Transações", subtitle: "Consulte as movimentações da unidade selecionada sem alterar os indicadores individuais das demais unidades." },
  "/contabilidade": { title: "Contabilidade", subtitle: "Profit & Loss — P&L por regime de competência e unidade, baseado nos lançamentos contábeis efetivamente postados." },
  "/unidades": { title: "Produtos / Unidades", subtitle: "Centros econômicos da Lander Solutions. Produtos e serviços permanecem cadastros vinculados quando necessário." },
  "/contratos": { title: "Contratos", subtitle: "Todos os instrumentos são celebrados pela LANDER SOLUTIONS. Unidade, produto e serviço definem a apuração gerencial; termos econômicos aprovados permanecem versionados e imutáveis." },
  "/rateio": { title: "Rateio de Custos", subtitle: "Divida despesas compartilhadas entre unidades e acompanhe a aprovação, a postagem e a memória de cálculo." },
  "/participacoes": { title: "Participações e Repasses", subtitle: "Apure participações contratuais, aprove memórias, gere obrigações financeiras e concilie os pagamentos realizados." },
  "/ativos": { title: "Ativos corporativos", subtitle: "Equipamentos, veículos, softwares, assinaturas, domínios, certificados, seguros e ativos intangíveis com trilha completa." },
  "/estrutura": { title: "Estrutura Corporativa", subtitle: "Gerencie entidades jurídicas, unidades, produtos, serviços, projetos, departamentos e centros de resultado." },
  "/propriedade-intelectual": { title: "Propriedade Intelectual", subtitle: "Proteja marcas, patentes, direitos autorais, obras e registros intelectuais. Equipamentos e licenças operacionais pertencem a Patrimônio." },
  "/relatorios": { title: "Relatórios", subtitle: "Consulte indicadores e demonstrativos corporativos baseados exclusivamente nos dados persistidos e postados." },
  "/auditoria": { title: "Trilha de auditoria", subtitle: "Consulte quem fez o quê, quando e em qual registro, com os detalhes técnicos preservados para investigação." },
  "/acessos": { title: "Acessos e permissões", subtitle: "Administre usuários, papéis, permissões e alcance de acesso. Alterações continuam protegidas por MFA e auditoria." },
  "/configuracoes-servicos-leads": { title: "Serviços de interesse dos leads", subtitle: "Página de configuração interna, sem item no menu principal. Os serviços ativos aparecem nos dropdowns do formulário de Leads." },
  "/configuracoes-templates-contratos": { title: "Templates de contratos", subtitle: "Página oculta e exclusiva para cadastrar, editar e administrar manualmente os modelos utilizados no módulo Contratos." },
  "/configuracoes-variaveis-contratos": { title: "Variáveis de contratos", subtitle: "Biblioteca empresarial compartilhada pelos templates e pela preparação de contratos." },
  "/configuracoes/integracoes": { title: "Configurações de integrações", subtitle: "Cadastro técnico mínimo de fluxos concretos que alimentam a gestão empresarial. Não administra assinaturas, tenants, usuários, permissões internas ou operações dos produtos." },
  "/juridico": { title: "Jurídico", subtitle: "Acompanhe assuntos jurídicos, processos, riscos, eventos e prazos da Lander Solutions." },
  "/compliance-politicas": { title: "Compliance e Políticas", subtitle: "Acompanhe obrigações, ocorrências e políticas corporativas em áreas claramente separadas." },
  "/repasses": { title: "Repasses", subtitle: "Acompanhe quem deve receber, quanto já foi pago e qual saldo permanece pendente por unidade." },
  "/estrutura-organizacional": { title: "Cadastros da Empresa", subtitle: "Administre entidades, departamentos, cargos, serviços, projetos e centros sem confundi-los com unidades econômicas." },
  "/estrutura-societaria": { title: "Estrutura Societária", subtitle: "Controle a estrutura societária e o capital das entidades jurídicas da Lander Solutions; participações de produtos não são cadastradas aqui." },
  "/patrimonio-licencas": { title: "Patrimônio e Licenças", subtitle: "Gerencie ativos físicos, equipamentos, licenças administrativas, custódia, garantia e renovação." },
  "/nota-fiscal": { title: "Notas Fiscais", subtitle: "Página única para criação, consulta e gestão das notas fiscais de entrada e saída." },
};

function periodLabel(period: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00`));
}
function dispatchPageEvent(name: string) { window.dispatchEvent(new CustomEvent(name)); }
function AuthenticatedUserControls() {
  const { profile, signOut } = useAuth();
  return <><div className="hidden max-w-32 truncate text-xs text-muted-foreground 2xl:block">{profile?.display_name || profile?.email}</div><Button type="button" variant="ghost" size="icon" title="Encerrar sessão" aria-label="Encerrar sessão" onClick={() => void signOut()}><LogOut /></Button></>;
}

export function Topbar() {
  const { unit, setUnit, period, setPeriod } = useWorkspace();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDashboard = pathname === "/";
  const isAgenda = pathname === "/agenda";
  const isCrm = pathname === "/crm";
  const isContracts = pathname === "/contratos";
  const isContractTemplates = pathname === "/configuracoes-templates-contratos";
  const isContractVariables = pathname === "/configuracoes-variaveis-contratos";
  const isFiscal = pathname === "/nota-fiscal";
  const isHr = pathname === "/rh";
  const isSupport = pathname === "/atendimento";
  const isTransactions = pathname === "/transacoes";
  const isAccounting = pathname === "/contabilidade";
  const isUnits = pathname === "/unidades";
  const isAllocations = pathname === "/rateio";
  const isParticipations = pathname === "/participacoes";
  const isOperationalScopePage = pathname === "/unidades" || pathname.startsWith("/unidades/") || ["/rateio", "/repasses", "/estrutura-organizacional", "/estrutura-societaria", "/patrimonio-licencas", "/juridico", "/compliance-politicas", "/propriedade-intelectual", "/atendimento", "/relatorios", "/acessos", "/auditoria", "/configuracoes/integracoes"].includes(pathname);
  const pageHeader = pathname.startsWith("/unidades/") ? PAGE_HEADERS["/unidades"] : PAGE_HEADERS[pathname];
  const [crmTab, setCrmTab] = useState<"contacts" | "leads">("contacts");

  useEffect(() => {
    if (!isCrm) return;
    const handleTabChange = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: "contacts" | "leads" }>).detail?.tab;
      if (tab === "contacts" || tab === "leads") setCrmTab(tab);
    };
    const resetTimer = window.setTimeout(() => setCrmTab("contacts"), 0);
    window.addEventListener("crm:tab-change", handleTabChange);
    return () => { window.clearTimeout(resetTimer); window.removeEventListener("crm:tab-change", handleTabChange); };
  }, [isCrm]);

  const showUnitSelector = !isDashboard && !isAgenda && !isCrm && !isTransactions && !isAccounting && !isFiscal && !isContracts && !isContractTemplates && !isContractVariables && !isSupport && !isAllocations && !isParticipations;
  const showPeriodSelector = !isDashboard && !isAgenda && !isCrm && !isTransactions && !isAccounting && !isFiscal && !isContracts && !isContractTemplates && !isContractVariables && !isHr && !isUnits && !isSupport && !isAllocations && !isParticipations;
  const optionsQuery = useQuery({ queryKey: ["workspace-options"], queryFn: listWorkspaceOptions, enabled: showUnitSelector || showPeriodSelector });
  const units = optionsQuery.data?.units ?? [];
  const periodOptions = [...new Map((optionsQuery.data?.periods ?? []).map((item) => [item.periodStart.slice(0, 7), item])).entries()];
  const selectedPeriodRegistered = periodOptions.some(([value]) => value === period);

  return (
    <header className={`sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-3 backdrop-blur ${pageHeader ? "min-h-16 py-2" : "h-14"} ${isAgenda || isTransactions || isAccounting ? "flex-wrap xl:flex-nowrap" : isOperationalScopePage || pageHeader ? "flex-wrap sm:flex-nowrap" : ""}`}>
      <SidebarTrigger className="shrink-0" />
      {pageHeader && <div className={`${isAgenda || isTransactions || isAccounting ? "min-w-0 basis-[calc(100%-3rem)] xl:basis-auto" : isOperationalScopePage ? "min-w-0 basis-[calc(100%-3rem)] sm:basis-auto" : "min-w-0"} flex-1`}><h1 className="break-words text-base font-semibold tracking-tight">{pageHeader.title}</h1><p className="mt-0.5 break-words text-xs leading-4 text-muted-foreground">{pageHeader.subtitle}</p></div>}

      {isTransactions && <div className="order-3 grid min-w-0 basis-full grid-cols-2 items-center gap-2 [&>button]:min-w-0 [&>button]:w-full sm:flex sm:flex-wrap xl:order-none xl:basis-auto xl:flex-nowrap"><Button size="sm" variant="outline" onClick={() => dispatchPageEvent("transactions:import-ofx")}><FileUp className="h-4 w-4" /> Importar OFX</Button><Button size="sm" variant="outline" onClick={() => dispatchPageEvent("transactions:connect-account")}><Landmark className="h-4 w-4" /> Conectar conta</Button><Button size="sm" variant="outline" onClick={() => dispatchPageEvent("transactions:refresh")}><RefreshCw className="h-4 w-4" /> Atualizar transações</Button><Button size="sm" onClick={() => dispatchPageEvent("transactions:new")}><Plus className="h-4 w-4" /> Nova transação</Button></div>}

      <div className={`${pageHeader ? "ml-0" : "ml-auto"} flex shrink-0 items-center gap-2 ${isAgenda || isAccounting ? "order-3 w-full flex-wrap xl:order-none xl:w-auto xl:flex-nowrap" : isOperationalScopePage || pageHeader ? "order-3 w-full flex-wrap sm:order-none sm:w-auto sm:flex-nowrap" : ""} ${isTransactions && !AUTHENTICATION_ENABLED ? "hidden" : ""}`}>
        {isCrm && <Button size="sm" onClick={() => dispatchPageEvent(crmTab === "contacts" ? "crm:new-contact" : "crm:new-lead")}><Plus className="h-4 w-4" />{crmTab === "contacts" ? "Novo Contato" : "Novo Lead"}</Button>}
        {isContracts && <><Button size="sm" variant="outline" asChild><Link to="/configuracoes-templates-contratos">Templates de contratos</Link></Button><Button size="sm" onClick={() => dispatchPageEvent("contracts:create")}><Plus className="h-4 w-4" /> Criar contrato</Button></>}
        {isContractTemplates && <><Button size="sm" variant="outline" asChild><Link to="/configuracoes-variaveis-contratos"><Braces className="h-4 w-4" /> Configurar variáveis</Link></Button><Button size="sm" onClick={() => dispatchPageEvent("contract-templates:create")}><Plus className="h-4 w-4" /> Novo template</Button></>}
        {isContractVariables && <Button size="sm" variant="outline" asChild><Link to="/configuracoes-templates-contratos"><ArrowLeft className="h-4 w-4" /> Voltar aos templates</Link></Button>}
        {isAgenda && <Button size="sm" onClick={() => dispatchPageEvent("agenda:create")}><Plus className="h-4 w-4" /> Novo compromisso</Button>}
        {isFiscal && <Button size="sm" onClick={() => dispatchPageEvent("fiscal:create")}><Plus className="h-4 w-4" /> Registrar nota</Button>}
        {showUnitSelector && <Select value={unit} disabled={optionsQuery.isLoading} onValueChange={(value) => setUnit(value as UnitFilter)}><SelectTrigger className={`${isOperationalScopePage || pageHeader ? "min-w-0 flex-1 sm:flex-none" : ""} w-[170px] rounded-sm text-xs`}><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as unidades</SelectItem>{units.map((item) => <SelectItem key={item.id} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select>}
        {isHr && <Button size="sm" onClick={() => dispatchPageEvent("hr:new-employee")}><Plus className="h-4 w-4" /> Novo colaborador</Button>}
        {isAccounting && <><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline"><FileSpreadsheet className="h-4 w-4" /> Importar/Exportar XLSX</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => dispatchPageEvent("accounting:import-xlsx")}><Upload className="h-4 w-4" /> Importar XLSX</DropdownMenuItem><DropdownMenuItem onSelect={() => dispatchPageEvent("accounting:export-xlsx")}><Download className="h-4 w-4" /> Exportar XLSX</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button size="sm" variant="outline" onClick={() => dispatchPageEvent("accounting:print")}><Printer className="h-4 w-4" /> PDF / Imprimir</Button></>}
        {showPeriodSelector && <Select value={period} onValueChange={setPeriod} disabled={optionsQuery.isLoading}><SelectTrigger className={`${isOperationalScopePage || pageHeader ? "min-w-0 flex-1 sm:flex-none" : ""} w-[165px] rounded-sm text-xs`}><SelectValue placeholder="Competência" /></SelectTrigger><SelectContent>{!selectedPeriodRegistered && <SelectItem value={period}>{periodLabel(period)} — não cadastrada</SelectItem>}{periodOptions.map(([value, item]) => <SelectItem key={item.id} value={value}>{periodLabel(value)} — {item.status}</SelectItem>)}</SelectContent></Select>}
        {(showUnitSelector || showPeriodSelector) && optionsQuery.isError && <span className="hidden text-xs text-destructive 2xl:block">Falha ao carregar filtros</span>}
        {AUTHENTICATION_ENABLED && <AuthenticatedUserControls />}
      </div>
    </header>
  );
}
