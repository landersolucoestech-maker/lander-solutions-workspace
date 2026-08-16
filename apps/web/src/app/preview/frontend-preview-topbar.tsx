import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarDays, ChevronDown, Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";

const NAV_ITEMS = [
  ["Dashboard", "/"], ["CRM", "/crm"], ["Agenda", "/agenda"], ["Produtos / Unidades", "/unidades"],
  ["Contratos", "/contratos"], ["Transações", "/transacoes"], ["Contabilidade", "/contabilidade"],
  ["Notas Fiscais", "/nota-fiscal"], ["Rateio de Custos", "/rateio"], ["Participações", "/participacoes"],
  ["Repasses", "/repasses"], ["Atendimento", "/atendimento"], ["Recursos Humanos", "/rh"],
  ["Jurídico", "/juridico"], ["Compliance", "/compliance-politicas"], ["Relatórios", "/relatorios"],
  ["Acessos", "/acessos"], ["Auditoria", "/auditoria"],
] as const;

export function FrontendPreviewTopbar() {
  const [unit, setUnit] = useState("todas");
  const [period, setPeriod] = useState("2026-08");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? NAV_ITEMS.filter(([label]) => label.toLowerCase().includes(term)).slice(0, 6) : NAV_ITEMS.slice(0, 6);
  }, [search]);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 px-3 py-2 backdrop-blur md:px-5">
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <div className="hidden min-w-0 flex-1 md:block">
          <p className="text-xs font-medium text-muted-foreground">Sistema Central</p>
          <p className="truncate text-sm font-semibold">Lander Solutions Ltda.</p>
        </div>

        {searchOpen ? (
          <div className="relative order-3 flex w-full items-center gap-2 md:order-none md:w-80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar páginas e módulos" className="pl-9" />
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border bg-popover shadow-lg">
                {results.map(([label, to]) => (
                  <Link key={to} to={to} onClick={() => { setSearchOpen(false); setSearch(""); }} className="flex items-center justify-between border-b px-3 py-2.5 text-sm last:border-0 hover:bg-muted">
                    <span>{label}</span><span className="text-xs text-muted-foreground">Abrir</span>
                  </Link>
                ))}
                {results.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum módulo encontrado.</p>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setSearchOpen(false); setSearch(""); }}>Fechar</Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="icon" title="Buscar" aria-label="Buscar no sistema" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /></Button>
        )}

        <Select value={unit} onValueChange={setUnit}><SelectTrigger className="w-[170px]"><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as unidades</SelectItem><SelectItem value="music-os-360">Music OS 360</SelectItem><SelectItem value="vivendo-da-musica">Vivendo da Música</SelectItem><SelectItem value="corporativo">Corporativo</SelectItem></SelectContent></Select>
        <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[155px]"><CalendarDays className="h-4 w-4" /><SelectValue placeholder="Competência" /></SelectTrigger><SelectContent><SelectItem value="2026-08">Agosto / 2026</SelectItem><SelectItem value="2026-07">Julho / 2026</SelectItem><SelectItem value="2026-06">Junho / 2026</SelectItem></SelectContent></Select>

        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" title="Notificações" aria-label="Notificações"><Bell className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80"><DropdownMenuLabel>Notificações</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/repasses" className="flex-col items-start gap-0.5"><span className="font-medium">Repasse pendente</span><span className="text-xs text-muted-foreground">Music OS 360 · competência 08/2026</span></Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/contratos" className="flex-col items-start gap-0.5"><span className="font-medium">Contrato próximo do vencimento</span><span className="text-xs text-muted-foreground">CTR-2026-028 · 31/10/2026</span></Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/atendimento" className="flex-col items-start gap-0.5"><span className="font-medium">SLA de atendimento em risco</span><span className="text-xs text-muted-foreground">SUP-1047 · Aurora Digital</span></Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>

        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className="gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">LS</span><span className="hidden text-xs sm:inline">Administrador</span><ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>Conta administrativa</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/acessos">Acessos e permissões</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/auditoria">Trilha de auditoria</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/configuracoes/integracoes">Configurações de integrações</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
  );
}
