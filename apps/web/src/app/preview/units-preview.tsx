import { ArrowRight, Building2, Plus, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusPill } from "@/shared/components/ui-kit";

const units = [
  { id: "music-os-360", name: "Music OS 360", type: "SaaS", revenue: "R$ 82.400", result: "R$ 54.300", margin: "65,9%", status: "Ativo", description: "Gestão e distribuição musical." },
  { id: "vivendo-da-musica", name: "Vivendo da Música", type: "Produto digital", revenue: "R$ 61.780", result: "R$ 39.350", margin: "63,7%", status: "Ativo", description: "Educação e produtos para o mercado musical." },
  { id: "corporativo", name: "Corporativo", type: "Centro corporativo", revenue: "R$ 40.740", result: "R$ 19.790", margin: "48,6%", status: "Ativo", description: "Serviços, projetos e custos centrais." },
];

export function UnitsPreview() {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const visible = useMemo(() => units.filter((unit) => `${unit.name} ${unit.type} ${unit.description}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="label-caps">OPERAÇÕES</p><h1 className="mt-1 text-3xl font-semibold">Produtos / Unidades</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Centros econômicos da Lander Solutions com acompanhamento individual de receita, custos, resultado, contratos, rateios e participações.</p></div><Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nova unidade</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Unidades ativas", "3"], ["Receita consolidada", "R$ 184.920"], ["Resultado distribuível", "R$ 113.440"], ["Margem média", "61,3%"]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <section className="rounded-lg border bg-card p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold">Unidades de negócio</h2><p className="text-sm text-muted-foreground">Abra uma unidade para visualizar sua operação completa.</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar unidade" className="pl-9" /></div></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{visible.map((unit) => <article key={unit.id} className="flex flex-col rounded-lg border p-4 transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><StatusPill status={unit.status} /></div><h3 className="mt-4 font-semibold">{unit.name}</h3><p className="mt-1 text-xs font-medium text-primary">{unit.type}</p><p className="mt-2 min-h-10 text-sm text-muted-foreground">{unit.description}</p><div className="mt-4 grid grid-cols-3 gap-2 border-y py-3 text-xs"><div><span className="block text-muted-foreground">Receita</span><strong className="mt-1 block">{unit.revenue}</strong></div><div><span className="block text-muted-foreground">Resultado</span><strong className="mt-1 block">{unit.result}</strong></div><div><span className="block text-muted-foreground">Margem</span><strong className="mt-1 block">{unit.margin}</strong></div></div><Button className="mt-4 w-full" asChild><Link to="/unidades/$unitId" params={{ unitId: unit.id }}>Abrir unidade <ArrowRight className="h-4 w-4" /></Link></Button></article>)}</div>{visible.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>}</section>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nova unidade</DialogTitle><DialogDescription>Estruture um novo centro econômico da Lander Solutions.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-1.5"><Label>Nome</Label><Input placeholder="Nome da unidade" /></div><div className="space-y-1.5"><Label>Tipo</Label><Input placeholder="SaaS, produto, serviço ou projeto" /></div><div className="space-y-1.5"><Label>Descrição</Label><Input placeholder="Descrição operacional" /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => setCreateOpen(false)}>Salvar unidade</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
