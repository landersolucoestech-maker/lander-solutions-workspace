import { useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ArrowRight, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { StatusPill } from "@/shared/components/ui-kit";

type PageDefinition = {
  title: string;
  description: string;
  kpis: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
  primaryAction: string;
};

const PAGES: Record<string, PageDefinition> = {
  "/": {
    title: "Dashboard",
    description: "Visão consolidada da operação, faturamento, custos, resultado distribuível e repasses da Lander Solutions.",
    kpis: [
      { label: "Faturamento bruto", value: "R$ 184.920" },
      { label: "Custos e impostos", value: "R$ 71.480" },
      { label: "Resultado distribuível", value: "R$ 113.440" },
      { label: "Repasses pendentes", value: "R$ 28.360" },
    ],
    columns: ["Unidade", "Receita", "Custos", "Resultado", "Margem", "Status"],
    rows: [
      ["Music OS 360", "R$ 82.400", "R$ 28.100", "R$ 54.300", "65,9%", "Saudável"],
      ["Vivendo da Música", "R$ 61.780", "R$ 22.430", "R$ 39.350", "63,7%", "Saudável"],
      ["Projetos corporativos", "R$ 40.740", "R$ 20.950", "R$ 19.790", "48,6%", "Atenção"],
    ],
    primaryAction: "Ver relatório completo",
  },
  "/crm": {
    title: "CRM",
    description: "Contatos, clientes e leads em uma única operação comercial.",
    kpis: [],
    columns: [],
    rows: [],
    primaryAction: "Novo Contato / Cliente",
  },
  "/agenda": page("Agenda corporativa", "Compromissos, prazos, reuniões e eventos operacionais.", ["Compromisso", "Data", "Responsável", "Vínculo", "Status"], [["Reunião financeira", "18/08/2026 09:00", "Deyvisson", "Corporativo", "Confirmado"],["Revisão de contrato", "19/08/2026 14:00", "Jurídico", "Music OS 360", "Pendente"],["Fechamento mensal", "31/08/2026 17:00", "Financeiro", "Corporativo", "Planejado"]], "Novo compromisso"),
  "/estrutura-organizacional": page("Cadastros da Empresa", "Entidades, departamentos, cargos, produtos, serviços, projetos e centros financeiros.", ["Código", "Cadastro", "Tipo", "Vínculo", "Status"], [["SRV-001", "Desenvolvimento de software", "Serviço", "Corporativo", "Ativo"],["PRD-001", "Music OS 360", "Produto", "Music OS 360", "Ativo"],["DEP-001", "Financeiro", "Departamento", "Corporativo", "Ativo"]], "Novo registro"),
  "/estrutura": page("Estrutura Corporativa", "Mapa operacional das entidades, unidades e estruturas que sustentam a Lander Solutions.", ["Elemento", "Categoria", "Responsável", "Situação"], [["Lander Solutions Ltda.", "Entidade jurídica", "Diretoria", "Ativo"],["Music OS 360", "Unidade de negócio", "Gestão de Produto", "Ativo"],["Vivendo da Música", "Unidade de negócio", "Gestão de Produto", "Ativo"]], "Novo elemento"),
  "/estrutura-societaria": page("Estrutura Societária", "Capital social, sócios e participações da entidade jurídica.", ["Sócio", "Documento", "Participação", "Capital", "Status"], [["Sócio administrador", "***.***.***-**", "60%", "R$ 60.000", "Ativo"],["Sócio investidor", "***.***.***-**", "40%", "R$ 40.000", "Ativo"]], "Novo sócio"),
  "/unidades": page("Produtos / Unidades", "Centros econômicos com acompanhamento próprio de receita, custos e resultado.", ["Unidade", "Tipo", "Receita mês", "Resultado", "Status"], [["Music OS 360", "SaaS", "R$ 82.400", "R$ 54.300", "Ativo"],["Vivendo da Música", "Produto digital", "R$ 61.780", "R$ 39.350", "Ativo"],["Corporativo", "Centro corporativo", "R$ 40.740", "R$ 19.790", "Ativo"]], "Nova unidade"),
  "/ativos": page("Ativos corporativos", "Equipamentos, softwares, domínios e ativos intangíveis.", ["Ativo", "Categoria", "Responsável", "Valor", "Status"], [["Notebook Dell 01", "Equipamento", "Tecnologia", "R$ 7.900", "Em uso"],["lander.solutions", "Domínio", "Tecnologia", "R$ 180/ano", "Ativo"],["Figma Professional", "Software", "Design", "R$ 920/mês", "Ativo"]], "Novo ativo"),
  "/patrimonio-licencas": page("Patrimônio e Licenças", "Controle de patrimônio, custódia, garantias e licenças administrativas.", ["Item", "Patrimônio", "Custódia", "Renovação", "Status"], [["MacBook Pro M4", "PAT-0021", "Design", "—", "Em uso"],["Microsoft 365", "LIC-0008", "Corporativo", "12/11/2026", "Ativo"],["Certificado A1", "LIC-0012", "Fiscal", "08/01/2027", "Ativo"]], "Novo patrimônio"),
  "/contratos": page("Contratos", "Instrumentos celebrados pela Lander Solutions e vinculados a clientes, produtos, serviços e unidades.", ["Contrato", "Cliente", "Objeto", "Valor", "Vigência", "Status"], [["CTR-2026-041", "Orbita Comércio Ltda.", "Desenvolvimento SaaS", "R$ 48.000", "01/08/26–31/01/27", "Ativo"],["CTR-2026-039", "Nexo Produções", "Licença Music OS 360", "R$ 2.490/mês", "15/07/26–14/07/27", "Ativo"],["CTR-2026-032", "Aurora Digital", "Consultoria", "R$ 18.500", "10/06/26–10/09/26", "Ativo"]], "Criar contrato"),
  "/transacoes": page("Transações", "Receitas e despesas conciliadas por unidade, conta, centro e competência.", ["Data", "Descrição", "Tipo", "Unidade", "Conta", "Valor"], [["16/08/2026", "Recebimento contrato CTR-041", "Receita", "Corporativo", "Itaú", "+ R$ 12.000"],["16/08/2026", "AWS Cloud", "Despesa", "Music OS 360", "Inter", "- R$ 4.820"],["15/08/2026", "Stripe", "Taxa financeira", "Vivendo da Música", "Stripe", "- R$ 1.760"]], "Nova transação"),
  "/contabilidade": page("Contabilidade", "Demonstração gerencial por competência com receitas, custos e resultado.", ["Conta", "Categoria", "Débito", "Crédito", "Saldo"], [["Receita de serviços", "Receita", "R$ 0", "R$ 122.180", "R$ 122.180 C"],["Receita SaaS", "Receita", "R$ 0", "R$ 62.740", "R$ 62.740 C"],["Infraestrutura", "Despesa", "R$ 31.400", "R$ 0", "R$ 31.400 D"]], "Exportar demonstrativo"),
  "/nota-fiscal": page("Notas Fiscais", "Emissão e controle de documentos fiscais de entrada e saída.", ["Número", "Tipo", "Cliente / Fornecedor", "Emissão", "Valor", "Status"], [["NFS-e 000184", "Saída", "Orbita Comércio Ltda.", "16/08/2026", "R$ 12.000", "Emitida"],["NFS-e 000183", "Saída", "Nexo Produções", "15/08/2026", "R$ 2.490", "Emitida"],["NF-e 438219", "Entrada", "Dell Brasil", "12/08/2026", "R$ 7.900", "Recebida"]], "Registrar nota"),
  "/rateio": page("Rateio de Custos", "Distribuição de despesas compartilhadas entre produtos, projetos e corporativo.", ["Competência", "Despesa", "Critério", "Origem", "Destinos", "Status"], [["08/2026", "Google Workspace", "Usuários ativos", "Corporativo", "3 unidades", "Calculado"],["08/2026", "Contabilidade", "Receita proporcional", "Corporativo", "3 unidades", "Aprovado"],["08/2026", "AWS compartilhada", "Uso/consumo", "Tecnologia", "2 unidades", "Pendente"]], "Novo rateio"),
  "/participacoes": page("Participações", "Regras de participação econômica aplicadas ao resultado distribuível.", ["Beneficiário", "Unidade", "Base", "Percentual", "Vigência", "Status"], [["Sócio A", "Music OS 360", "Resultado líquido", "35%", "01/01/2026", "Ativo"],["Sócio B", "Music OS 360", "Resultado líquido", "15%", "01/01/2026", "Ativo"],["Sócio A", "Vivendo da Música", "Resultado líquido", "40%", "01/03/2026", "Ativo"]], "Nova participação"),
  "/repasses": page("Repasses", "Obrigações de pagamento derivadas das participações aprovadas.", ["Beneficiário", "Competência", "Unidade", "Valor devido", "Pago", "Saldo"], [["Sócio A", "08/2026", "Music OS 360", "R$ 19.005", "R$ 9.500", "R$ 9.505"],["Sócio B", "08/2026", "Music OS 360", "R$ 8.145", "R$ 8.145", "R$ 0"],["Sócio A", "08/2026", "Vivendo da Música", "R$ 15.740", "R$ 0", "R$ 15.740"]], "Registrar repasse"),
  "/atendimento": page("Atendimento e Suporte", "Filas, tickets, conversas e SLAs dos clientes e produtos.", ["Ticket", "Cliente", "Assunto", "Produto", "SLA", "Status"], [["SUP-1048", "Nexo Produções", "Acesso ao painel", "Music OS 360", "1h 12m", "Em atendimento"],["SUP-1047", "Aurora Digital", "Dúvida contratual", "Corporativo", "3h 20m", "Aberto"],["SUP-1046", "Orbita Comércio", "Integração API", "Projeto SaaS", "Resolvido", "Fechado"]], "Novo ticket"),
  "/rh": page("Recursos Humanos", "Colaboradores, vínculos, documentos, equipamentos e rotinas administrativas.", ["Colaborador", "Cargo", "Departamento", "Admissão", "Vínculo", "Status"], [["Marina Costa", "Analista Financeiro", "Financeiro", "04/03/2025", "CLT", "Ativo"],["Rafael Lima", "Desenvolvedor", "Tecnologia", "12/08/2024", "PJ", "Ativo"],["Camila Souza", "Designer", "Produto", "18/02/2026", "PJ", "Ativo"]], "Novo colaborador"),
  "/juridico": page("Jurídico", "Assuntos jurídicos, processos, riscos, eventos e prazos.", ["Caso", "Tipo", "Responsável", "Prazo", "Risco", "Status"], [["JUR-026", "Contratual", "Assessoria jurídica", "22/08/2026", "Baixo", "Em análise"],["JUR-021", "Marca", "Propriedade intelectual", "30/09/2026", "Médio", "Em andamento"]], "Novo assunto"),
  "/compliance-politicas": page("Compliance e Políticas", "Obrigações, políticas corporativas, ocorrências e revisões.", ["Documento", "Categoria", "Versão", "Revisão", "Responsável", "Status"], [["Política de Segurança", "Segurança", "2.1", "10/12/2026", "Tecnologia", "Vigente"],["Política de Privacidade", "LGPD", "3.0", "03/01/2027", "Jurídico", "Vigente"]], "Nova política"),
  "/propriedade-intelectual": page("Propriedade Intelectual", "Marcas, obras, registros e demais ativos intelectuais.", ["Ativo", "Tipo", "Registro", "Titular", "Validade", "Status"], [["LANDER SOLUTIONS", "Marca", "INPI 940112233", "Lander Solutions Ltda.", "2035", "Protocolado"],["Music OS 360", "Marca", "INPI 940221144", "Lander Solutions Ltda.", "2035", "Em exame"]], "Novo registro"),
  "/acessos": page("Acessos e Permissões", "Usuários, papéis, permissões e escopos de acesso.", ["Usuário", "Papel", "Escopo", "Último acesso", "MFA", "Status"], [["deyvisson@lander.solutions", "Administrador", "Todas as unidades", "16/08/2026 19:42", "Ativo", "Ativo"],["financeiro@lander.solutions", "Financeiro", "Corporativo", "16/08/2026 17:10", "Ativo", "Ativo"]], "Novo acesso"),
  "/auditoria": page("Trilha de auditoria", "Registro de ações relevantes executadas dentro do sistema.", ["Data/hora", "Usuário", "Ação", "Módulo", "Registro", "Resultado"], [["16/08/2026 19:41", "Administrador", "UPDATE", "Contratos", "CTR-2026-041", "Sucesso"],["16/08/2026 19:38", "Financeiro", "CREATE", "Transações", "TRX-8821", "Sucesso"]], "Exportar trilha"),
  "/relatorios": page("Relatórios", "Demonstrativos gerenciais e indicadores consolidados da operação.", ["Relatório", "Escopo", "Competência", "Última geração", "Status"], [["DRE gerencial", "Todas as unidades", "08/2026", "16/08/2026 18:30", "Disponível"],["Resultado por unidade", "Produtos / SaaS", "08/2026", "16/08/2026 18:31", "Disponível"],["Repasses pendentes", "Societário", "08/2026", "16/08/2026 18:32", "Disponível"]], "Gerar relatório"),
  "/integracoes": page("Integrações", "Conectores que alimentam a operação corporativa.", ["Integração", "Categoria", "Última sincronização", "Registros", "Status"], [["Supabase", "Dados", "16/08/2026 19:40", "12.480", "Conectado"],["Stripe", "Pagamentos", "16/08/2026 19:36", "1.842", "Conectado"],["Resend", "E-mail", "16/08/2026 19:32", "428", "Conectado"]], "Configurar integração"),
  "/configuracoes/integracoes": page("Configurações de Integrações", "Credenciais, escopos e parâmetros técnicos dos conectores.", ["Conector", "Ambiente", "Escopo", "Validação", "Status"], [["Supabase", "Produção", "Banco/Auth", "16/08/2026", "Válido"],["Stripe", "Produção", "Pagamentos", "16/08/2026", "Válido"]], "Nova configuração"),
  "/configuracoes-servicos-leads": page("Serviços de Leads", "Serviços disponíveis para seleção e qualificação comercial.", ["Serviço", "Unidade", "Categoria", "Ordem", "Status"], [["Desenvolvimento SaaS", "Corporativo", "Tecnologia", "1", "Ativo"],["Music OS 360", "Music OS 360", "SaaS", "2", "Ativo"],["Consultoria estratégica", "Corporativo", "Consultoria", "3", "Ativo"]], "Novo serviço"),
  "/configuracoes-templates-contratos": page("Templates de Contratos", "Modelos padronizados utilizados na criação dos contratos.", ["Template", "Categoria", "Versão", "Última alteração", "Status"], [["Prestação de Serviços", "Serviços", "v4", "12/08/2026", "Ativo"],["Licença SaaS", "SaaS", "v3", "01/08/2026", "Ativo"]], "Novo template"),
  "/configuracoes-variaveis-contratos": page("Variáveis de Contratos", "Biblioteca de variáveis reutilizáveis nos templates contratuais.", ["Variável", "Rótulo", "Origem", "Obrigatória", "Status"], [["{{cliente.razao_social}}", "Razão social", "Cliente", "Sim", "Ativa"],["{{contrato.valor}}", "Valor do contrato", "Contrato", "Sim", "Ativa"]], "Nova variável"),
};

function page(title: string, description: string, columns: string[], rows: string[][], primaryAction: string): PageDefinition {
  return {
    title,
    description,
    primaryAction,
    columns,
    rows,
    kpis: [
      { label: "Total", value: String(rows.length * 12 + 4) },
      { label: "Ativos", value: String(rows.length * 9 + 2) },
      { label: "Pendentes", value: String(rows.length + 1) },
      { label: "Atualizados hoje", value: String(rows.length * 2) },
    ],
  };
}

const CRM_CONTACTS = [
  ["Orbita Comércio Ltda.", "Cliente", "Pessoa Jurídica", "financeiro@orbita.com.br", "Music OS 360", "Ativo"],
  ["Nexo Produções", "Cliente", "Pessoa Jurídica", "contato@nexoproducoes.com", "Vivendo da Música", "Ativo"],
  ["Marina Carvalho", "Contato", "Pessoa Física", "marina@auroradigital.com", "Corporativo", "Ativo"],
  ["Cloud Partners Brasil", "Parceiro", "Pessoa Jurídica", "parcerias@cloudpartners.com", "Corporativo", "Ativo"],
];

const CRM_LEADS = [
  ["Aurora Digital", "Pessoa Jurídica", "contato@auroradigital.com", "Desenvolvimento SaaS", "Site", "Qualificado"],
  ["Estúdio Horizonte", "Pessoa Jurídica", "studio@horizonte.com", "Music OS 360", "Indicação", "Novo"],
  ["Lucas Mendes", "Pessoa Física", "lucas@email.com", "Consultoria", "WhatsApp", "Contato pendente"],
];

export function FrontendPreviewPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/crm") return <CrmPreview />;
  const definition = PAGES[pathname] ?? page("Página", "Conteúdo operacional da Lander Solutions.", ["Registro", "Categoria", "Responsável", "Status"], [["Registro de exemplo", "Operacional", "Equipe Lander", "Ativo"]], "Novo registro");
  return <GenericPreview definition={definition} />;
}

function GenericPreview({ definition }: { definition: PageDefinition }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? definition.rows.filter((row) => row.join(" ").toLowerCase().includes(term)) : definition.rows;
  }, [definition.rows, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-caps">LANDER SOLUTIONS</p>
          <h2 className="mt-1 text-2xl font-semibold">{definition.title}</h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{definition.description}</p>
        </div>
        <Button onClick={() => setMessage(`${definition.primaryAction}: ação aberta no modo frontend.`)}>
          <Plus className="h-4 w-4" /> {definition.primaryAction}
        </Button>
      </div>

      {definition.kpis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {definition.kpis.map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">Registros</h3>
            <p className="text-sm text-muted-foreground">Conteúdo completo de demonstração do frontend.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nesta página" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60">
              <tr>{definition.columns.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th></tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${row[0]}-${index}`} className="border-t">
                  {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3">{cellIndex === row.length - 1 ? <StatusPill status={cell} /> : cell}</td>)}
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><Action icon={<Eye />} label="Ver" onClick={() => setMessage(`Visualizando: ${row[0]}`)} /><Action icon={<Pencil />} label="Editar" onClick={() => setMessage(`Editando: ${row[0]}`)} /><Action icon={<Trash2 />} label="Arquivar" onClick={() => setMessage(`Arquivamento de ${row[0]} aberto.`)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"><span>{message}</span><Button size="sm" variant="outline" onClick={() => setMessage(null)}>Fechar</Button></div>}
    </div>
  );
}

function CrmPreview() {
  const [tab, setTab] = useState<"contacts" | "leads">("contacts");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const rows = tab === "contacts" ? CRM_CONTACTS : CRM_LEADS;
  const columns = tab === "contacts" ? ["Nome", "Relacionamento", "Tipo", "Contato", "Unidade", "Status"] : ["Lead", "Tipo", "Contato", "Serviço", "Origem", "Status"];
  const visibleRows = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
  const kpis = tab === "contacts" ? [{label:"Contatos / clientes",value:"48"},{label:"Clientes ativos",value:"31"},{label:"Parceiros",value:"7"},{label:"Outros contatos",value:"10"}] : [{label:"Total de leads",value:"23"},{label:"Novos",value:"8"},{label:"Qualificados",value:"6"},{label:"Convertidos no mês",value:"9"}];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="label-caps">COMERCIAL</p><h2 className="mt-1 text-2xl font-semibold">CRM</h2><p className="mt-1 text-sm text-muted-foreground">Contatos, clientes e leads em uma única operação comercial.</p></div><Button onClick={() => setMessage(tab === "contacts" ? "Formulário de novo contato / cliente aberto." : "Formulário de novo lead aberto.")}><Plus className="h-4 w-4" />{tab === "contacts" ? "Novo Contato / Cliente" : "Novo Lead"}</Button></div>
      <div className="inline-flex rounded-lg border bg-muted/30 p-1"><Button size="sm" variant={tab === "contacts" ? "default" : "ghost"} onClick={() => {setTab("contacts");setQuery("");}}>Contatos / Clientes</Button><Button size="sm" variant={tab === "leads" ? "default" : "ghost"} onClick={() => {setTab("leads");setQuery("");}}>Leads</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold">{item.value}</p></div>)}</div>
      <section className="overflow-hidden rounded-lg border bg-card"><div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold">{tab === "contacts" ? "Contatos / Clientes" : "Leads"}</h3><p className="text-sm text-muted-foreground">{tab === "contacts" ? "Pessoas e empresas que já possuem relacionamento com a Lander Solutions." : "Oportunidades comerciais ainda não convertidas."}</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "contacts" ? "Buscar contato ou cliente" : "Buscar lead"} className="pl-9"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/60"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column}</th>)}<th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th></tr></thead><tbody>{visibleRows.map((row,index)=><tr key={`${row[0]}-${index}`} className="border-t">{row.map((cell,cellIndex)=><td key={`${cell}-${cellIndex}`} className="px-4 py-3">{cellIndex===row.length-1?<StatusPill status={cell}/>:cell}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1"><Action icon={<Eye/>} label="Ver" onClick={()=>setMessage(`Visualizando ${row[0]}.`)}/><Action icon={<Pencil/>} label="Editar" onClick={()=>setMessage(`Editando ${row[0]}.`)}/><Action icon={<ArrowRight/>} label={tab === "leads" ? "Converter" : "Abrir"} onClick={()=>setMessage(tab === "leads" ? `${row[0]} pronto para conversão em contato / cliente.` : `Cadastro de ${row[0]} aberto.`)}/></div></td></tr>)}</tbody></table></div></section>
      {message && <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"><span>{message}</span><Button size="sm" variant="outline" onClick={() => setMessage(null)}>Fechar</Button></div>}
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <Button type="button" size="icon" variant="ghost" title={label} aria-label={label} onClick={onClick}>{icon}</Button>;
}
