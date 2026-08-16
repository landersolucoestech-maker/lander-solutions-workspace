import { useMemo, useState } from "react";
import { Copy, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";

import {
  CONTRACT_TEMPLATE_VARIABLE_GROUPS,
  CONTRACT_TEMPLATE_VARIABLE_REGISTRY,
} from "@/modules/contracts/contract-template-variable-registry";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { EmptyRow, StatusPill } from "@/shared/components/ui-kit";

const TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  textarea: "Texto longo",
  date: "Data",
  number: "Número",
  currency: "Moeda",
  percentage: "Percentual",
  select: "Seleção",
};

export function ContractVariablesPage() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const variables = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter(
      (variable) =>
        (group === "all" || variable.group === group) &&
        (!normalized ||
          [variable.label, variable.key, variable.group, variable.source, variable.description]
            .join(" ")
            .toLowerCase()
            .includes(normalized)),
    );
  }, [group, search]);

  async function copyPlaceholder(key: string) {
    await navigator.clipboard.writeText(`{{${key}}}`);
    toast.success("Placeholder copiado.");
  }

  return (
    <div className="min-w-0 space-y-3 p-2 md:p-3">
      <section
        className="overflow-hidden rounded-sm border bg-card"
        data-testid="variable-registry-page"
      >
        <div className="space-y-3 border-b bg-muted/15 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, placeholder, grupo ou origem"
              aria-label="Buscar variáveis de contratos"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Grupos de variáveis">
            {["all", ...CONTRACT_TEMPLATE_VARIABLE_GROUPS].map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={group === item ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setGroup(item)}
              >
                {item === "all" ? "Todos" : item}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="label-caps">
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Placeholder</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Origem dos dados</th>
                <th className="px-3 py-2 text-left">Situação</th>
                <th className="px-3 py-2 text-left">Obrigatória</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {variables.length === 0 ? (
                <EmptyRow
                  colSpan={8}
                  label="Nenhuma variável corresponde aos filtros informados."
                />
              ) : null}
              {variables.map((variable) => (
                <tr key={variable.key} className="border-t align-middle hover:bg-muted/35">
                  <td className="max-w-72 px-3 py-2">
                    <p className="font-medium">{variable.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{variable.description}</p>
                  </td>
                  <td className="px-3 py-2">
                    <code className="whitespace-nowrap text-xs text-primary">{`{{${variable.key}}}`}</code>
                  </td>
                  <td className="px-3 py-2">{variable.group}</td>
                  <td className="px-3 py-2">{TYPE_LABELS[variable.type] ?? variable.type}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {variable.source || "Não resolvida"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={variable.active === false ? "Inativa" : "Ativa"} />
                  </td>
                  <td className="px-3 py-2">{variable.required ? "Obrigatória" : "Opcional"}</td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Ações da variável ${variable.label}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void copyPlaceholder(variable.key)}>
                          <Copy className="h-4 w-4" /> Copiar placeholder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
