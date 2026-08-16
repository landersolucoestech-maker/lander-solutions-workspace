import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { StatusPill } from "@/shared/components/ui-kit";

const rows = [
  ["Reunião financeira", "18/08/2026 09:00", "Deyvisson", "Corporativo", "Confirmado"],
  ["Revisão de contrato", "19/08/2026 14:00", "Jurídico", "Music OS 360", "Pendente"],
  ["Fechamento mensal", "31/08/2026 17:00", "Financeiro", "Corporativo", "Planejado"],
];

export function AgendaPreview() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agenda corporativa</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compromissos, prazos, reuniões e eventos operacionais.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />Novo compromisso</Button>
      </div>

      <div className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                {["Compromisso", "Data", "Responsável", "Vínculo", "Status"].map((column) => <th key={column} className="px-4 py-3 font-medium">{column}</th>)}
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-b last:border-0">
                  {row.map((cell, index) => <td key={`${row[0]}-${index}`} className="px-4 py-3">{index === row.length - 1 ? <StatusPill status={cell} /> : cell}</td>)}
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="Ver"><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
