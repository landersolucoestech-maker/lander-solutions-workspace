import { useState } from "react";
import { ArrowLeft, BarChart3, FileSignature, Pencil, Plus, Scale, WalletCards } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusPill } from "@/shared/components/ui-kit";

const units: Record<string, { name: string; type: string; description: string; revenue: string; costs: string; result: string; margin: string }> = {
  "music-os-360": { name: "Music OS 360", type: "SaaS", description: "Plataforma operacional para gestão e distribuição musical.", revenue: "R$ 82.400", costs: "R$ 28.100", result: "R$ 54.300", margin: "65,9%" },
  "vivendo-da-musica": { name: "Vivendo da Música", type: "Produto digital", description: "Ecossistema educacional e comercial voltado ao mercado musical.", revenue: "R$ 61.780", costs: "R$ 22.430", result: "R$ 39.350", margin: "63,7%" },
  corporativo: { name: "Corporativo", type: "Centro corporativo", description: "Estrutura central de serviços, projetos e custos compartilhados da Lander Solutions.", revenue: "R$ 40.740", costs: "R$ 20.950", result: "R$ 19.790", margin: "48,6%" },
};

export function UnitDetailPreview() {
  const { unitId } = useParams({ strict: false }) as { unitId?: string };
  const unit = units[unitId ?? ""] ?? { name: "Unidade de negócio", type: "Unidade", description: "Centro econômico da Lander Solutions.", revenue: "R$ 0", costs: "R$ 0", result: "R$ 0", margin: "0%" };
  const [tab, setTab] = useState("Visão geral");
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><Button variant="ghost" size="sm" asChild className="-ml-2 mb-2"><Link to="/unidades"><ArrowLeft className="h-4 w-4" /> Voltar às unidades</Link></Button><p className="label-caps">UNIDADE DE NEGÓCIO</p><h1 className="mt-1 text-3xl font-semibold">{unit.name}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill status="Ativo" /><span className="text-sm text-muted-foreground">{unit.type}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{unit.description}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editar unidade</Button><Button onClick={() => setNotice("Novo vínculo operacional aberto na demonstração.")}><Plus className="h-4 w-4" /> Novo vínculo</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Receita do mês", unit.revenue], ["Custos e impostos", unit.costs], ["Resultado", unit.result], ["Margem", unit.margin]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>

    <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">{["Visão geral", "Financeiro", "Contratos", "Custos & Rateios", "Participações", "Projetos"].map((item) => <Button key={item} size="sm" className="shrink-0" variant={tab === item ? "default" : "ghost"} onClick={() => setTab(item)}>{item}</Button>)}</nav>
    {notice && <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3 text-sm"><span>{notice}</span><Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Fechar</Button></div>}

    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-lg border bg-card p-5 shadow-sm xl:col-span-2"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{tab}</h2><p className="mt-1 text-sm text-muted-foreground">Detalhamento econômico e operacional da unidade selecionada.</p></div><BarChart3 className="h-5 w-5 text-primary" /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b bg-muted/40"><th className="px-3 py-2 text-left">Indicador / vínculo</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-left">Competência</th><th className="px-3 py-2 text-left">Valor</th><th className="px-3 py-2 text-left">Status</th></tr></thead><tbody>{[["Receita operacional", "Receita", "08/2026", unit.revenue, "Postado"], ["Custos diretos", "Custo", "08/2026", unit.costs, "Postado"], ["Resultado distribuível", "Resultado", "08/2026", unit.result, "Apurado"], ["Contrato principal", "Contrato", "Vigente", "CTR-2026-039", "Ativo"]].map((row) => <tr key={row[0]} className="border-b last:border-0">{row.map((cell, index) => <td key={cell} className="px-3 py-3">{index === 4 ? <StatusPill status={cell} /> : cell}</td>)}</tr>)}</tbody></table></div></section>
      <aside className="space-y-4"><section className="rounded-lg border bg-card p-4 shadow-sm"><h2 className="font-semibold">Atalhos da unidade</h2><div className="mt-3 grid gap-2"><Button variant="outline" asChild><Link to="/transacoes"><WalletCards className="h-4 w-4" /> Ver transações</Link></Button><Button variant="outline" asChild><Link to="/contratos"><FileSignature className="h-4 w-4" /> Ver contratos</Link></Button><Button variant="outline" asChild><Link to="/rateio"><Scale className="h-4 w-4" /> Ver rateios</Link></Button></div></section><section className="rounded-lg border bg-card p-4 shadow-sm"><h2 className="font-semibold">Saúde da unidade</h2><div className="mt-3 space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Margem</span><strong>{unit.margin}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Contratos ativos</span><strong>8</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Rateios pendentes</span><strong>1</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Repasses pendentes</span><strong>2</strong></div></div></section></aside>
    </div>

    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Editar unidade</DialogTitle><DialogDescription>Atualize os dados visuais da unidade na demonstração de frontend.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-1.5"><Label>Nome</Label><Input defaultValue={unit.name} /></div><div className="space-y-1.5"><Label>Tipo</Label><Input defaultValue={unit.type} /></div><div className="space-y-1.5"><Label>Descrição</Label><Input defaultValue={unit.description} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button><Button onClick={() => { setEditOpen(false); setNotice("Alterações da unidade salvas na demonstração."); }}>Salvar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
