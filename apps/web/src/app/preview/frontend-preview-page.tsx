import { useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusPill } from "@/shared/components/ui-kit";

type Kpi = { label: string; value: string; hint?: string };
type PageDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  kpis: Kpi[];
  tabs?: string[];
  columns: string[];
  rows: string[][];
  primaryAction: string;
  secondaryAction?: string;
  highlights?: Array<{ title: string; value: string; description: string }>;
  pending?: string[];
};

function makePage(
  eyebrow: string,
  title: string,
  description: string,
  columns: string[],
  rows: string[][],
  primaryAction: string,
  kpis: Kpi[] = [],
  tabs?: string[],
): PageDefinition {
  return {
    eyebrow,
    title,
    description,
    columns,
    rows,
    primaryAction,
    kpis,
    tabs,
    secondaryAction: "Exportar",
    highlights: [
      {
        title: "Registros visíveis",
        value: String(rows.length),
        description: "Itens apresentados nesta visão de frontend.",
      },
      {
        title: "Escopo",
        value: "Lander Solutions",
        description: "Visão consolidada da organização e das unidades vinculadas.",
      },
    ],
    pending: [
      "Revisar cadastros com informações incompletas.",
      "Validar itens com prazo ou competência em aberto.",
    ],
  };
}

const PAGES: Record<string, PageDefinition> = {
  "/": {
    eyebrow: "VISÃO EXECUTIVA",
    title: "Dashboard",
    description:
      "Visão consolidada da operação, faturamento, custos, resultado distribuível e repasses da Lander Solutions.",
    kpis: [
      { label: "Faturamento bruto", value: "R$ 184.920", hint: "+12,4% no mês" },
      { label: "Custos e impostos", value: "R$ 71.480", hint: "38,7% do faturamento" },
      { label: "Resultado distribuível", value: "R$ 113.440", hint: "61,3% de margem" },
      { label: "Repasses pendentes", value: "R$ 28.360", hint: "3 obrigações" },
    ],
    tabs: ["Visão geral", "Financeiro", "Unidades", "Obrigações"],
    columns: ["Unidade", "Receita", "Custos", "Resultado", "Margem", "Status"],
    rows: [
      ["Music OS 360", "R$ 82.400", "R$ 28.100", "R$ 54.300", "65,9%", "Saudável"],
      ["Vivendo da Música", "R$ 61.780", "R$ 22.430", "R$ 39.350", "63,7%", "Saudável"],
      ["Projetos corporativos", "R$ 40.740", "R$ 20.950", "R$ 19.790", "48,6%", "Atenção"],
    ],
    primaryAction: "Abrir relatório gerencial",
    secondaryAction: "Exportar dashboard",
    highlights: [
      {
        title: "Receita recorrente",
        value: "R$ 94.870",
        description: "SaaS, licenças e contratos recorrentes ativos.",
      },
      {
        title: "Caixa disponível",
        value: "R$ 126.740",
        description: "Saldo consolidado das contas operacionais.",
      },
      {
        title: "A receber",
        value: "R$ 52.300",
        description: "Títulos previstos para os próximos 30 dias.",
      },
    ],
    pending: [
      "3 repasses aguardam pagamento.",
      "2 contratos vencem nos próximos 30 dias.",
      "1 rateio compartilhado aguarda aprovação.",
    ],
  },
  "/crm": {
    eyebrow: "COMERCIAL",
    title: "CRM",
    description: "Contatos, clientes e leads em uma única operação comercial.",
    kpis: [],
    tabs: ["Contatos / Clientes", "Leads"],
    columns: [],
    rows: [],
    primaryAction: "Novo Contato / Cliente",
  },
  "/agenda": makePage(
    "OPERAÇÕES",
    "Agenda corporativa",
    "Compromissos, prazos, reuniões e eventos operacionais.",
    ["Compromisso", "Data", "Responsável", "Vínculo", "Status"],
    [
      ["Reunião financeira", "18/08/2026 09:00", "Deyvisson", "Corporativo", "Confirmado"],
      ["Revisão de contrato", "19/08/2026 14:00", "Jurídico", "Music OS 360", "Pendente"],
      ["Fechamento mensal", "31/08/2026 17:00", "Financeiro", "Corporativo", "Planejado"],
      ["Revisão de produto", "21/08/2026 10:30", "Produto", "Vivendo da Música", "Confirmado"],
    ],
    "Novo compromisso",
    [
      { label: "Hoje", value: "4" },
      { label: "Esta semana", value: "11" },
      { label: "Prazos críticos", value: "2" },
      { label: "Concluídos", value: "18" },
    ],
    ["Agenda", "Prazos", "Reuniões"],
  ),
  "/estrutura-organizacional": makePage(
    "EMPRESA",
    "Cadastros da Empresa",
    "Entidades, departamentos, cargos, produtos, serviços, projetos e centros financeiros.",
    ["Código", "Cadastro", "Tipo", "Vínculo", "Status"],
    [
      ["SRV-001", "Desenvolvimento de software", "Serviço", "Corporativo", "Ativo"],
      ["PRD-001", "Music OS 360", "Produto", "Music OS 360", "Ativo"],
      ["PRD-002", "Vivendo da Música", "Produto", "Vivendo da Música", "Ativo"],
      ["DEP-001", "Financeiro", "Departamento", "Corporativo", "Ativo"],
      ["DEP-002", "Tecnologia", "Departamento", "Corporativo", "Ativo"],
    ],
    "Novo registro",
    [
      { label: "Entidades", value: "1" },
      { label: "Departamentos", value: "7" },
      { label: "Produtos", value: "4" },
      { label: "Serviços", value: "9" },
    ],
    ["Serviços", "Produtos", "Entidades", "Departamentos", "Cargos", "Projetos", "Centros"],
  ),
  "/estrutura": makePage(
    "EMPRESA",
    "Estrutura Corporativa",
    "Mapa operacional das entidades, unidades e estruturas que sustentam a Lander Solutions.",
    ["Elemento", "Categoria", "Responsável", "Situação"],
    [
      ["Lander Solutions Ltda.", "Entidade jurídica", "Diretoria", "Ativo"],
      ["Music OS 360", "Unidade de negócio", "Gestão de Produto", "Ativo"],
      ["Vivendo da Música", "Unidade de negócio", "Gestão de Produto", "Ativo"],
      ["Financeiro", "Departamento", "Diretoria", "Ativo"],
    ],
    "Novo elemento",
    [
      { label: "Entidades", value: "1" },
      { label: "Unidades", value: "3" },
      { label: "Departamentos", value: "7" },
      { label: "Projetos ativos", value: "6" },
    ],
  ),
  "/estrutura-societaria": makePage(
    "EMPRESA",
    "Estrutura Societária",
    "Capital social, sócios, quotas e composição societária da entidade jurídica.",
    ["Sócio", "Documento", "Participação", "Capital", "Status"],
    [
      ["Sócio administrador", "***.***.***-**", "60%", "R$ 60.000", "Ativo"],
      ["Sócio investidor", "***.***.***-**", "40%", "R$ 40.000", "Ativo"],
    ],
    "Novo sócio",
    [
      { label: "Capital social", value: "R$ 100.000" },
      { label: "Sócios ativos", value: "2" },
      { label: "Quotas emitidas", value: "100.000" },
      { label: "Capital integralizado", value: "100%" },
    ],
    ["Sócios", "Capital", "Alterações"],
  ),
  "/unidades": makePage(
    "OPERAÇÕES",
    "Produtos / Unidades",
    "Centros econômicos com acompanhamento próprio de receita, custos e resultado.",
    ["Unidade", "Tipo", "Receita mês", "Resultado", "Margem", "Status"],
    [
      ["Music OS 360", "SaaS", "R$ 82.400", "R$ 54.300", "65,9%", "Ativo"],
      ["Vivendo da Música", "Produto digital", "R$ 61.780", "R$ 39.350", "63,7%", "Ativo"],
      ["Corporativo", "Centro corporativo", "R$ 40.740", "R$ 19.790", "48,6%", "Ativo"],
    ],
    "Nova unidade",
    [
      { label: "Unidades ativas", value: "3" },
      { label: "Receita consolidada", value: "R$ 184.920" },
      { label: "Resultado", value: "R$ 113.440" },
      { label: "Margem média", value: "61,3%" },
    ],
    ["Unidades", "Produtos", "Serviços", "Projetos"],
  ),
  "/ativos": makePage(
    "EMPRESA",
    "Ativos corporativos",
    "Equipamentos, softwares, domínios e ativos intangíveis.",
    ["Ativo", "Categoria", "Responsável", "Valor", "Status"],
    [
      ["Notebook Dell 01", "Equipamento", "Tecnologia", "R$ 7.900", "Em uso"],
      ["lander.solutions", "Domínio", "Tecnologia", "R$ 180/ano", "Ativo"],
      ["Figma Professional", "Software", "Design", "R$ 920/mês", "Ativo"],
      ["Certificado digital A1", "Certificado", "Fiscal", "R$ 260/ano", "Ativo"],
    ],
    "Novo ativo",
    [
      { label: "Ativos", value: "42" },
      { label: "Em uso", value: "36" },
      { label: "Renovações 30d", value: "4" },
      { label: "Valor patrimonial", value: "R$ 286.400" },
    ],
    ["Todos", "Equipamentos", "Softwares", "Domínios", "Intangíveis"],
  ),
  "/patrimonio-licencas": makePage(
    "EMPRESA",
    "Patrimônio e Licenças",
    "Controle de patrimônio, custódia, garantias e licenças administrativas.",
    ["Item", "Patrimônio", "Custódia", "Renovação", "Status"],
    [
      ["MacBook Pro M4", "PAT-0021", "Design", "—", "Em uso"],
      ["Microsoft 365", "LIC-0008", "Corporativo", "12/11/2026", "Ativo"],
      ["Certificado A1", "LIC-0012", "Fiscal", "08/01/2027", "Ativo"],
      ["Adobe Creative Cloud", "LIC-0015", "Design", "24/09/2026", "Ativo"],
    ],
    "Novo patrimônio",
    [
      { label: "Patrimônios", value: "28" },
      { label: "Licenças", value: "19" },
      { label: "Em custódia", value: "24" },
      { label: "Renovações próximas", value: "3" },
    ],
    ["Patrimônio", "Licenças", "Custódia", "Renovações"],
  ),
  "/contratos": makePage(
    "CONTRATOS",
    "Contratos",
    "Instrumentos celebrados pela Lander Solutions e vinculados a clientes, produtos, serviços e unidades.",
    ["Contrato", "Cliente", "Objeto", "Valor", "Vigência", "Status"],
    [
      ["CTR-2026-041", "Orbita Comércio Ltda.", "Desenvolvimento SaaS", "R$ 48.000", "01/08–31/01", "Ativo"],
      ["CTR-2026-039", "Nexo Produções", "Licença Music OS 360", "R$ 2.490/mês", "15/07–14/07", "Ativo"],
      ["CTR-2026-032", "Aurora Digital", "Consultoria", "R$ 18.500", "10/06–10/09", "Ativo"],
      ["CTR-2026-028", "Estúdio Horizonte", "Serviços de distribuição", "R$ 9.800", "01/05–31/10", "Renovação"],
    ],
    "Criar contrato",
    [
      { label: "Contratos ativos", value: "27" },
      { label: "Receita contratada", value: "R$ 312.900" },
      { label: "Vencem em 30d", value: "2" },
      { label: "Aguardando assinatura", value: "4" },
    ],
    ["Todos", "Ativos", "Rascunhos", "Assinaturas", "Renovações"],
  ),
  "/transacoes": makePage(
    "FINANCEIRO",
    "Transações",
    "Receitas e despesas conciliadas por unidade, conta, centro e competência.",
    ["Data", "Descrição", "Tipo", "Unidade", "Conta", "Valor", "Status"],
    [
      ["16/08/2026", "Recebimento CTR-041", "Receita", "Corporativo", "Itaú", "+ R$ 12.000", "Conciliada"],
      ["16/08/2026", "AWS Cloud", "Despesa", "Music OS 360", "Inter", "- R$ 4.820", "Conciliada"],
      ["15/08/2026", "Stripe", "Taxa financeira", "Vivendo da Música", "Stripe", "- R$ 1.760", "Conciliada"],
      ["15/08/2026", "Google Workspace", "Despesa", "Corporativo", "Inter", "- R$ 860", "Ratear"],
    ],
    "Nova transação",
    [
      { label: "Entradas no mês", value: "R$ 184.920" },
      { label: "Saídas no mês", value: "R$ 71.480" },
      { label: "Saldo líquido", value: "R$ 113.440" },
      { label: "Não conciliadas", value: "6" },
    ],
    ["Todas", "Receitas", "Despesas", "Não conciliadas", "Importações"],
  ),
  "/contabilidade": makePage(
    "FINANCEIRO",
    "Contabilidade",
    "Demonstração gerencial por competência com receitas, custos e resultado.",
    ["Conta", "Categoria", "Débito", "Crédito", "Saldo"],
    [
      ["Receita de serviços", "Receita", "R$ 0", "R$ 122.180", "R$ 122.180 C"],
      ["Receita SaaS", "Receita", "R$ 0", "R$ 62.740", "R$ 62.740 C"],
      ["Infraestrutura", "Despesa", "R$ 31.400", "R$ 0", "R$ 31.400 D"],
      ["Impostos", "Despesa", "R$ 18.930", "R$ 0", "R$ 18.930 D"],
    ],
    "Novo lançamento",
    [
      { label: "Receita", value: "R$ 184.920" },
      { label: "Despesas", value: "R$ 71.480" },
      { label: "Resultado", value: "R$ 113.440" },
      { label: "Lançamentos", value: "186" },
    ],
    ["DRE", "Razão", "Balancete", "Plano de contas"],
  ),
  "/nota-fiscal": makePage(
    "FISCAL",
    "Notas Fiscais",
    "Emissão e controle de documentos fiscais de entrada e saída.",
    ["Número", "Tipo", "Cliente / Fornecedor", "Emissão", "Valor", "Status"],
    [
      ["NFS-e 000184", "Saída", "Orbita Comércio Ltda.", "16/08/2026", "R$ 12.000", "Emitida"],
      ["NFS-e 000183", "Saída", "Nexo Produções", "15/08/2026", "R$ 2.490", "Emitida"],
      ["NF-e 438219", "Entrada", "Dell Brasil", "12/08/2026", "R$ 7.900", "Recebida"],
      ["NFS-e 000182", "Saída", "Aurora Digital", "10/08/2026", "R$ 6.166", "Emitida"],
    ],
    "Registrar nota",
    [
      { label: "Emitidas no mês", value: "34" },
      { label: "Valor de saída", value: "R$ 171.300" },
      { label: "Notas de entrada", value: "18" },
      { label: "Pendências fiscais", value: "2" },
    ],
    ["Todas", "Saída", "Entrada", "Pendências"],
  ),
  "/rateio": makePage(
    "CUSTOS & RATEIOS",
    "Rateio de Custos",
    "Distribuição de despesas compartilhadas entre produtos, projetos e corporativo.",
    ["Competência", "Despesa", "Critério", "Origem", "Destinos", "Status"],
    [
      ["08/2026", "Google Workspace", "Usuários ativos", "Corporativo", "3 unidades", "Calculado"],
      ["08/2026", "Contabilidade", "Receita proporcional", "Corporativo", "3 unidades", "Aprovado"],
      ["08/2026", "AWS compartilhada", "Uso/consumo", "Tecnologia", "2 unidades", "Pendente"],
      ["08/2026", "Figma", "Usuários ativos", "Design", "2 unidades", "Calculado"],
    ],
    "Novo rateio",
    [
      { label: "Custos compartilhados", value: "R$ 18.740" },
      { label: "Rateado", value: "R$ 14.980" },
      { label: "Pendente", value: "R$ 3.760" },
      { label: "Regras ativas", value: "7" },
    ],
    ["Rateios", "Regras", "Memórias", "Aprovações"],
  ),
  "/participacoes": makePage(
    "PARTICIPAÇÕES & REPASSES",
    "Participações",
    "Regras de participação econômica aplicadas ao resultado distribuível.",
    ["Beneficiário", "Unidade", "Base", "Percentual", "Vigência", "Status"],
    [
      ["Sócio A", "Music OS 360", "Resultado líquido", "35%", "01/01/2026", "Ativo"],
      ["Sócio B", "Music OS 360", "Resultado líquido", "15%", "01/01/2026", "Ativo"],
      ["Sócio A", "Vivendo da Música", "Resultado líquido", "40%", "01/03/2026", "Ativo"],
    ],
    "Nova participação",
    [
      { label: "Regras ativas", value: "8" },
      { label: "Beneficiários", value: "4" },
      { label: "Unidades abrangidas", value: "3" },
      { label: "Apurações abertas", value: "2" },
    ],
    ["Participações", "Apurações", "Memórias"],
  ),
  "/repasses": makePage(
    "PARTICIPAÇÕES & REPASSES",
    "Repasses",
    "Obrigações de pagamento derivadas das participações aprovadas.",
    ["Beneficiário", "Competência", "Unidade", "Valor devido", "Pago", "Saldo", "Status"],
    [
      ["Sócio A", "08/2026", "Music OS 360", "R$ 19.005", "R$ 9.500", "R$ 9.505", "Parcial"],
      ["Sócio B", "08/2026", "Music OS 360", "R$ 8.145", "R$ 8.145", "R$ 0", "Pago"],
      ["Sócio A", "08/2026", "Vivendo da Música", "R$ 15.740", "R$ 0", "R$ 15.740", "Pendente"],
    ],
    "Registrar repasse",
    [
      { label: "Total devido", value: "R$ 42.890" },
      { label: "Pago", value: "R$ 17.645" },
      { label: "Saldo pendente", value: "R$ 25.245" },
      { label: "Beneficiários", value: "3" },
    ],
    ["Obrigações", "Pagamentos", "Conciliação"],
  ),
  "/atendimento": makePage(
    "ATENDIMENTO",
    "Atendimento e Suporte",
    "Filas, tickets, conversas e SLAs dos clientes e produtos.",
    ["Ticket", "Cliente", "Assunto", "Produto", "SLA", "Status"],
    [
      ["SUP-1048", "Nexo Produções", "Acesso ao painel", "Music OS 360", "1h 12m", "Em atendimento"],
      ["SUP-1047", "Aurora Digital", "Dúvida contratual", "Corporativo", "3h 20m", "Aberto"],
      ["SUP-1046", "Orbita Comércio", "Integração API", "Projeto SaaS", "Resolvido", "Fechado"],
      ["SUP-1045", "Estúdio Horizonte", "Distribuição", "Music OS 360", "42m", "Em atendimento"],
    ],
    "Novo ticket",
    [
      { label: "Abertos", value: "12" },
      { label: "Em atendimento", value: "7" },
      { label: "SLA em risco", value: "2" },
      { label: "Resolvidos hoje", value: "18" },
    ],
    ["Caixa de entrada", "Tickets", "SLA", "Automações"],
  ),
  "/rh": makePage(
    "GESTÃO CORPORATIVA",
    "Recursos Humanos",
    "Colaboradores, vínculos, documentos, equipamentos e rotinas administrativas.",
    ["Colaborador", "Cargo", "Departamento", "Admissão", "Vínculo", "Status"],
    [
      ["Marina Costa", "Analista Financeiro", "Financeiro", "04/03/2025", "CLT", "Ativo"],
      ["Rafael Lima", "Desenvolvedor", "Tecnologia", "12/08/2024", "PJ", "Ativo"],
      ["Camila Souza", "Designer", "Produto", "18/02/2026", "PJ", "Ativo"],
      ["João Ribeiro", "Analista Comercial", "Comercial", "08/06/2026", "CLT", "Ativo"],
    ],
    "Novo colaborador",
    [
      { label: "Colaboradores", value: "18" },
      { label: "CLT", value: "8" },
      { label: "Prestadores", value: "10" },
      { label: "Onboardings", value: "2" },
    ],
    ["Pessoas", "Vínculos", "Documentos", "Ausências", "Equipamentos", "Onboarding"],
  ),
  "/juridico": makePage(
    "GOVERNANÇA",
    "Jurídico",
    "Assuntos jurídicos, processos, riscos, eventos e prazos.",
    ["Caso", "Tipo", "Responsável", "Prazo", "Risco", "Status"],
    [
      ["JUR-026", "Contratual", "Assessoria jurídica", "22/08/2026", "Baixo", "Em análise"],
      ["JUR-021", "Marca", "Propriedade intelectual", "30/09/2026", "Médio", "Em andamento"],
      ["JUR-019", "Societário", "Diretoria", "15/10/2026", "Baixo", "Acompanhamento"],
    ],
    "Novo assunto",
    [
      { label: "Assuntos ativos", value: "9" },
      { label: "Prazos 30d", value: "4" },
      { label: "Risco alto", value: "0" },
      { label: "Contratos em revisão", value: "5" },
    ],
    ["Assuntos", "Processos", "Prazos", "Documentos"],
  ),
  "/compliance-politicas": makePage(
    "GOVERNANÇA",
    "Compliance e Políticas",
    "Obrigações, políticas corporativas, ocorrências e revisões.",
    ["Documento", "Categoria", "Versão", "Revisão", "Responsável", "Status"],
    [
      ["Política de Segurança", "Segurança", "2.1", "10/12/2026", "Tecnologia", "Vigente"],
      ["Política de Privacidade", "LGPD", "3.0", "03/01/2027", "Jurídico", "Vigente"],
      ["Código de Conduta", "Governança", "1.4", "15/02/2027", "Diretoria", "Vigente"],
    ],
    "Nova política",
    [
      { label: "Políticas vigentes", value: "14" },
      { label: "Revisões próximas", value: "3" },
      { label: "Obrigações abertas", value: "5" },
      { label: "Ocorrências", value: "1" },
    ],
    ["Políticas", "Obrigações", "Ocorrências", "Revisões"],
  ),
  "/propriedade-intelectual": makePage(
    "GOVERNANÇA",
    "Propriedade Intelectual",
    "Marcas, obras, registros e demais ativos intelectuais.",
    ["Ativo", "Tipo", "Registro", "Titular", "Validade", "Status"],
    [
      ["LANDER SOLUTIONS", "Marca", "INPI 940112233", "Lander Solutions Ltda.", "2035", "Protocolado"],
      ["Music OS 360", "Marca", "INPI 940221144", "Lander Solutions Ltda.", "2035", "Em exame"],
      ["SONORIX", "Software", "Registro interno", "Lander Solutions Ltda.", "—", "Documentado"],
    ],
    "Novo registro",
    [
      { label: "Ativos registrados", value: "11" },
      { label: "Marcas", value: "6" },
      { label: "Softwares", value: "4" },
      { label: "Em exame", value: "2" },
    ],
    ["Marcas", "Softwares", "Obras", "Prazos"],
  ),
  "/acessos": makePage(
    "GOVERNANÇA",
    "Acessos e Permissões",
    "Usuários, papéis, permissões e escopos de acesso.",
    ["Usuário", "Papel", "Escopo", "Último acesso", "MFA", "Status"],
    [
      ["deyvisson@lander.solutions", "Administrador", "Todas as unidades", "16/08 19:42", "Ativo", "Ativo"],
      ["financeiro@lander.solutions", "Financeiro", "Corporativo", "16/08 17:10", "Ativo", "Ativo"],
      ["suporte@lander.solutions", "Atendimento", "Produtos", "16/08 18:05", "Ativo", "Ativo"],
    ],
    "Novo acesso",
    [
      { label: "Usuários ativos", value: "18" },
      { label: "Papéis", value: "7" },
      { label: "MFA ativo", value: "100%" },
      { label: "Acessos pendentes", value: "1" },
    ],
    ["Usuários", "Papéis", "Permissões", "Escopos"],
  ),
  "/auditoria": makePage(
    "GOVERNANÇA",
    "Trilha de auditoria",
    "Registro de ações relevantes executadas dentro do sistema.",
    ["Data/hora", "Usuário", "Ação", "Módulo", "Registro", "Resultado"],
    [
      ["16/08 19:41", "Administrador", "UPDATE", "Contratos", "CTR-2026-041", "Sucesso"],
      ["16/08 19:38", "Financeiro", "CREATE", "Transações", "TRX-8821", "Sucesso"],
      ["16/08 18:57", "Comercial", "UPDATE", "CRM", "LEAD-031", "Sucesso"],
    ],
    "Exportar trilha",
    [
      { label: "Eventos hoje", value: "286" },
      { label: "Alterações", value: "94" },
      { label: "Falhas", value: "2" },
      { label: "Usuários ativos", value: "12" },
    ],
    ["Eventos", "Alterações", "Acessos", "Falhas"],
  ),
  "/relatorios": makePage(
    "GESTÃO CORPORATIVA",
    "Relatórios",
    "Demonstrativos gerenciais e indicadores consolidados da operação.",
    ["Relatório", "Escopo", "Competência", "Última geração", "Status"],
    [
      ["DRE gerencial", "Todas as unidades", "08/2026", "16/08 18:30", "Disponível"],
      ["Resultado por unidade", "Produtos / SaaS", "08/2026", "16/08 18:31", "Disponível"],
      ["Repasses pendentes", "Participações", "08/2026", "16/08 18:32", "Disponível"],
      ["Fluxo de caixa", "Corporativo", "08/2026", "16/08 18:33", "Disponível"],
    ],
    "Gerar relatório",
    [
      { label: "Relatórios", value: "16" },
      { label: "Favoritos", value: "5" },
      { label: "Agendados", value: "4" },
      { label: "Gerados hoje", value: "12" },
    ],
    ["Gerenciais", "Financeiros", "Operacionais", "Agendados"],
  ),
  "/integracoes": makePage(
    "GESTÃO CORPORATIVA",
    "Integrações",
    "Conectores que alimentam a operação corporativa.",
    ["Integração", "Categoria", "Última sincronização", "Registros", "Status"],
    [
      ["Supabase", "Dados", "16/08 19:40", "12.480", "Conectado"],
      ["Stripe", "Pagamentos", "16/08 19:36", "1.842", "Conectado"],
      ["Resend", "E-mail", "16/08 19:32", "428", "Conectado"],
    ],
    "Configurar integração",
    [
      { label: "Conectadas", value: "6" },
      { label: "Com falha", value: "0" },
      { label: "Sincronizações hoje", value: "48" },
      { label: "Registros processados", value: "14.750" },
    ],
  ),
  "/configuracoes/integracoes": makePage(
    "CONFIGURAÇÕES",
    "Configurações de Integrações",
    "Credenciais, escopos e parâmetros técnicos dos conectores.",
    ["Conector", "Ambiente", "Escopo", "Validação", "Status"],
    [
      ["Supabase", "Produção", "Banco/Auth", "16/08/2026", "Válido"],
      ["Stripe", "Produção", "Pagamentos", "16/08/2026", "Válido"],
      ["Resend", "Produção", "E-mail", "16/08/2026", "Válido"],
    ],
    "Nova configuração",
    [],
    ["Conectores", "Credenciais", "Webhooks"],
  ),
  "/configuracoes-servicos-leads": makePage(
    "CONFIGURAÇÕES",
    "Serviços de Leads",
    "Serviços disponíveis para seleção e qualificação comercial.",
    ["Serviço", "Unidade", "Categoria", "Ordem", "Status"],
    [
      ["Desenvolvimento SaaS", "Corporativo", "Tecnologia", "1", "Ativo"],
      ["Music OS 360", "Music OS 360", "SaaS", "2", "Ativo"],
      ["Consultoria estratégica", "Corporativo", "Consultoria", "3", "Ativo"],
    ],
    "Novo serviço",
  ),
  "/configuracoes-templates-contratos": makePage(
    "CONFIGURAÇÕES",
    "Templates de Contratos",
    "Modelos padronizados utilizados na criação dos contratos.",
    ["Template", "Categoria", "Versão", "Última alteração", "Status"],
    [
      ["Prestação de Serviços", "Serviços", "v4", "12/08/2026", "Ativo"],
      ["Licença SaaS", "SaaS", "v3", "01/08/2026", "Ativo"],
      ["Parceria comercial", "Parcerias", "v2", "21/07/2026", "Ativo"],
    ],
    "Novo template",
    [],
    ["Templates", "Categorias", "Histórico"],
  ),
  "/configuracoes-variaveis-contratos": makePage(
    "CONFIGURAÇÕES",
    "Variáveis de Contratos",
    "Biblioteca de variáveis reutilizáveis nos templates contratuais.",
    ["Variável", "Rótulo", "Origem", "Obrigatória", "Status"],
    [
      ["{{cliente.razao_social}}", "Razão social", "Cliente", "Sim", "Ativa"],
      ["{{contrato.valor}}", "Valor do contrato", "Contrato", "Sim", "Ativa"],
      ["{{empresa.cnpj}}", "CNPJ da Lander", "Empresa", "Sim", "Ativa"],
    ],
    "Nova variável",
  ),
};

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

  const normalizedPath = pathname.startsWith("/unidades/") ? "/unidades" : pathname;
  return <BusinessPage definition={PAGES[normalizedPath] ?? fallbackPage()} />;
}

function BusinessPage({ definition }: { definition: PageDefinition }) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(definition.tabs?.[0] ?? "");
  const [dialog, setDialog] = useState<{ mode: "view" | "edit" | "create"; row?: string[] } | null>(null);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return definition.rows;
    return definition.rows.filter((row) => row.join(" ").toLowerCase().includes(term));
  }, [definition.rows, query]);

  return (
    <div className="space-y-5">
      <PageToolbar
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
        primaryAction={definition.primaryAction}
        secondaryAction={definition.secondaryAction}
        onPrimary={() => setDialog({ mode: "create" })}
      />

      {definition.tabs && definition.tabs.length > 0 && (
        <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" aria-label="Seções">
          {definition.tabs.map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={activeTab === tab ? "default" : "ghost"}
              className="shrink-0"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </nav>
      )}

      {definition.kpis.length > 0 && <KpiGrid items={definition.kpis} />}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">{activeTab || "Registros"}</h2>
              <p className="text-sm text-muted-foreground">{visibleRows.length} registro(s) nesta visão.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative min-w-0 sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar nesta página"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4" /> Exibição
              </Button>
            </div>
          </div>
          <DataTable
            columns={definition.columns}
            rows={visibleRows}
            onView={(row) => setDialog({ mode: "view", row })}
            onEdit={(row) => setDialog({ mode: "edit", row })}
          />
          <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Mostrando {visibleRows.length} de {definition.rows.length} registros</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled>Anterior</Button>
              <Button size="sm" variant="outline" disabled={visibleRows.length < 8}>Próxima</Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Resumo operacional</h2>
            <div className="mt-3 space-y-3">
              {(definition.highlights ?? []).map((item) => (
                <div key={item.title} className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
                  <p className="mt-1 font-semibold">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Pendências e atenção</h2>
            <div className="mt-3 space-y-2">
              {(definition.pending ?? []).map((item) => (
                <button key={item} type="button" className="flex w-full items-start gap-2 rounded-md border p-3 text-left text-sm transition hover:bg-muted/50">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <RecordDialog state={dialog} title={definition.title} columns={definition.columns} onClose={() => setDialog(null)} />
    </div>
  );
}

function CrmPreview() {
  const [tab, setTab] = useState<"contacts" | "leads">("contacts");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ mode: "view" | "edit" | "create"; row?: string[] } | null>(null);
  const rows = tab === "contacts" ? CRM_CONTACTS : CRM_LEADS;
  const columns = tab === "contacts"
    ? ["Nome", "Relacionamento", "Tipo", "Contato", "Unidade", "Status"]
    : ["Lead", "Tipo", "Contato", "Interesse", "Origem", "Status"];
  const visibleRows = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()));
  const kpis: Kpi[] = tab === "contacts"
    ? [
        { label: "Contatos / clientes", value: "48", hint: "31 clientes ativos" },
        { label: "Clientes ativos", value: "31", hint: "+4 no mês" },
        { label: "Parceiros", value: "7", hint: "2 estratégicos" },
        { label: "Outros contatos", value: "10", hint: "Relacionamentos ativos" },
      ]
    : [
        { label: "Total de leads", value: "23", hint: "Pipeline atual" },
        { label: "Novos", value: "8", hint: "Últimos 7 dias" },
        { label: "Qualificados", value: "6", hint: "26% do pipeline" },
        { label: "Convertidos no mês", value: "9", hint: "R$ 74 mil em propostas" },
      ];

  return (
    <div className="space-y-5">
      <PageToolbar
        eyebrow="COMERCIAL"
        title="CRM"
        description="Centralize contatos, clientes e leads e acompanhe todo o relacionamento comercial."
        primaryAction={tab === "contacts" ? "Novo Contato / Cliente" : "Novo Lead"}
        secondaryAction="Exportar CRM"
        onPrimary={() => setDialog({ mode: "create" })}
      />
      <nav className="flex gap-1 rounded-lg border bg-card p-1">
        <Button size="sm" variant={tab === "contacts" ? "default" : "ghost"} onClick={() => { setTab("contacts"); setQuery(""); }}>
          Contatos / Clientes
        </Button>
        <Button size="sm" variant={tab === "leads" ? "default" : "ghost"} onClick={() => { setTab("leads"); setQuery(""); }}>
          Leads
        </Button>
      </nav>
      <KpiGrid items={kpis} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">{tab === "contacts" ? "Contatos / Clientes" : "Leads"}</h2>
            <p className="text-sm text-muted-foreground">
              {tab === "contacts" ? "Pessoas e empresas que possuem relacionamento com a Lander Solutions." : "Oportunidades ainda não convertidas em clientes."}
            </p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <div className="relative min-w-0 flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "contacts" ? "Buscar contato ou cliente" : "Buscar lead"} className="pl-9" />
            </div>
            <Button variant="outline" size="sm"><Filter className="h-4 w-4" /> Filtros</Button>
          </div>
        </div>
        <DataTable columns={columns} rows={visibleRows} onView={(row) => setDialog({ mode: "view", row })} onEdit={(row) => setDialog({ mode: "edit", row })} />
      </section>
      <RecordDialog state={dialog} title={tab === "contacts" ? "Contato / Cliente" : "Lead"} columns={columns} onClose={() => setDialog(null)} />
    </div>
  );
}

function PageToolbar({ eyebrow, title, description, primaryAction, secondaryAction, onPrimary }: { eyebrow: string; title: string; description: string; primaryAction: string; secondaryAction?: string; onPrimary: () => void }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <p className="label-caps">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {secondaryAction && <Button variant="outline"><Download className="h-4 w-4" /> {secondaryAction}</Button>}
        <Button onClick={onPrimary}><Plus className="h-4 w-4" /> {primaryAction}</Button>
      </div>
    </div>
  );
}

function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
          {item.hint && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, onView, onEdit }: { columns: string[]; rows: string[][]; onView: (row: string[]) => void; onEdit: (row: string[]) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column}</th>)}
            <th className="w-16 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t transition hover:bg-muted/30">
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="whitespace-nowrap px-4 py-3">{cellIndex === row.length - 1 ? <StatusPill status={cell} /> : cell}</td>)}
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Ações de ${row[0]}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onView(row)}><Eye className="h-4 w-4" /> Ver</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(row)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem><Trash2 className="h-4 w-4" /> Arquivar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RecordDialog({ state, title, columns, onClose }: { state: { mode: "view" | "edit" | "create"; row?: string[] } | null; title: string; columns: string[]; onClose: () => void }) {
  const modeTitle = state?.mode === "create" ? `Novo ${title}` : state?.mode === "edit" ? `Editar ${title}` : `Visualizar ${title}`;
  const editable = state?.mode !== "view";
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modeTitle}</DialogTitle>
          <DialogDescription>{editable ? "Preencha ou ajuste as informações do registro. Esta é a experiência visual do frontend." : "Detalhes completos do registro selecionado."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {(columns.length > 0 ? columns : ["Nome", "Tipo", "Status"]).map((column, index) => (
            <div key={column} className="space-y-1.5">
              <Label>{column}</Label>
              <Input defaultValue={state?.row?.[index] ?? ""} disabled={!editable} placeholder={`Informe ${column.toLowerCase()}`} />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={!editable} placeholder="Observações adicionais" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{editable ? "Cancelar" : "Fechar"}</Button>
          {editable && <Button onClick={onClose}>Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fallbackPage(): PageDefinition {
  return makePage("LANDER SOLUTIONS", "Página", "Conteúdo operacional da Lander Solutions.", ["Registro", "Categoria", "Responsável", "Status"], [["Registro de exemplo", "Operacional", "Equipe Lander", "Ativo"]], "Novo registro");
}
