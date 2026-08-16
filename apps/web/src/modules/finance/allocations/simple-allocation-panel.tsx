import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { createAllocationRecord, deleteAllocationRecord, submitAllocationVersion } from "./api";
import type {
  AllocationMethod,
  AllocationRule,
  AllocationRuleVersion,
  AllocationTarget,
  AllocationWorkspace,
} from "./types";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function SimpleAllocationPanel({
  data,
  canManage,
  dataAccessRestricted,
  onCreated,
}: {
  data: AllocationWorkspace;
  canManage: boolean;
  dataAccessRestricted: boolean;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [sourceId, setSourceId] = useState("");
  const [method, setMethod] =
    useState<Extract<AllocationMethod, "equal" | "fixed_percentage">>("equal");
  const [beneficiaries, setBeneficiaries] = useState<Record<string, string>>({});
  const source = data.sourceCandidates.find((item) => item.journal_line_id === sourceId);
  const selectedUnits = data.businessUnits.filter((unit) => beneficiaries[unit.id] !== undefined);
  const preview = useMemo(() => {
    if (!source || selectedUnits.length === 0) return [];
    const equalPercentage = 100 / selectedUnits.length;
    return selectedUnits.map((unit) => {
      const percentage = method === "equal" ? equalPercentage : Number(beneficiaries[unit.id] || 0);
      return {
        ...unit,
        percentage,
        amount: (Number(source.available_amount) * percentage) / 100,
      };
    });
  }, [beneficiaries, method, selectedUnits, source]);
  const percentageTotal = preview.reduce((total, item) => total + item.percentage, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("Selecione uma despesa disponível para rateio.");
      if (selectedUnits.length === 0)
        throw new Error("Selecione ao menos uma unidade beneficiada.");
      if (method === "fixed_percentage" && Math.abs(percentageTotal - 100) > 0.0001) {
        throw new Error("Os percentuais precisam somar exatamente 100%.");
      }
      const sourceUnit = data.businessUnits.find((unit) => unit.id === source.business_unit_id);
      if (!sourceUnit?.legal_entity_id)
        throw new Error("A despesa não possui unidade de origem válida.");

      const suffix = Date.now().toString().slice(-10);
      const rule = await createAllocationRecord<AllocationRule>("allocation_rules", {
        legal_entity_id: sourceUnit.legal_entity_id,
        code: `DIV_${suffix}`,
        name: `Divisão de ${source.entry_description}`.slice(0, 120),
        description: `Despesa ${source.entry_number} · ${source.line_description || source.entry_description}`,
        source_business_unit_id: source.business_unit_id,
      });
      let version: AllocationRuleVersion | null = null;
      const createdTargets: AllocationTarget[] = [];
      try {
        version = await createAllocationRecord<AllocationRuleVersion>("allocation_rule_versions", {
          allocation_rule_id: rule.id,
          version_no: 1,
          method,
          effective_start: source.competence_date,
          source_managerial_account_id: source.managerial_account_id,
          source_category_id: source.category_id,
          source_cost_center_id: source.cost_center_id,
          source_project_id: source.project_id,
          residual_strategy: "largest_fraction",
          notes: `Despesa de referência: journal_line_id=${source.journal_line_id}. Após aprovação, a execução preserva a seleção explícita da origem.`,
        });
        for (const [index, unit] of selectedUnits.entries()) {
          const target = await createAllocationRecord<AllocationTarget>("allocation_rule_targets", {
            allocation_rule_version_id: version.id,
            business_unit_id: unit.id,
            sequence_no: index + 1,
            fixed_percentage: method === "fixed_percentage" ? Number(beneficiaries[unit.id]) : null,
          });
          createdTargets.push(target);
        }
        await submitAllocationVersion(version.id, version.version);
        return rule;
      } catch (error) {
        for (const target of createdTargets.reverse()) {
          await deleteAllocationRecord("allocation_rule_targets", target.id).catch(() => undefined);
        }
        if (version) {
          await deleteAllocationRecord("allocation_rule_versions", version.id).catch(
            () => undefined,
          );
        }
        await deleteAllocationRecord("allocation_rules", rule.id).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async () => {
      setSourceId("");
      setBeneficiaries({});
      setMethod("equal");
      await onCreated();
      toast.success(
        "Divisão enviada para aprovação. O motor avançado permanece responsável pela postagem.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao preparar a divisão."),
  });

  function toggleUnit(unitId: string) {
    setBeneficiaries((current) => {
      const next = { ...current };
      if (next[unitId] !== undefined) delete next[unitId];
      else next[unitId] = "0";
      return next;
    });
  }

  return (
    <section className="rounded-sm border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <Calculator className="h-5 w-5 text-primary" />
        <span className="flex-1">
          <strong className="block">Dividir uma despesa</strong>
          <span className="block text-sm text-muted-foreground">
            Escolha a despesa, as unidades beneficiadas e veja os valores antes de confirmar.
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-5 border-t p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>1. Qual despesa?</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma despesa postada" />
                </SelectTrigger>
                <SelectContent>
                  {data.sourceCandidates.map((item) => (
                    <SelectItem key={item.journal_line_id} value={item.journal_line_id}>
                      {item.entry_description} · {money(Number(item.available_amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.sourceCandidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {dataAccessRestricted
                    ? "Despesas elegíveis exigem uma sessão autorizada."
                    : "Nenhuma despesa postada possui saldo disponível para rateio."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>2. Como dividir?</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as "equal" | "fixed_percentage")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Igualmente</SelectItem>
                  <SelectItem value="fixed_percentage">Percentuais definidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>3. Quais unidades se beneficiam?</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.businessUnits
                .filter((unit) => unit.status === "active")
                .map((unit) => {
                  const selected = beneficiaries[unit.id] !== undefined;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      className={`flex items-center gap-2 rounded-sm border p-3 text-left text-sm ${selected ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => toggleUnit(unit.id)}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-sm border ${selected ? "border-primary bg-primary text-primary-foreground" : ""}`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span>{unit.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Percentual</th>
                    <th className="px-4 py-3 text-right">Valor previsto</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right">
                        {method === "fixed_percentage" ? (
                          <Input
                            className="ml-auto w-28 text-right"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={beneficiaries[item.id]}
                            onChange={(event) =>
                              setBeneficiaries((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          `${item.percentage.toFixed(2)}%`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {money(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{percentageTotal.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {money(preview.reduce((total, item) => total + item.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-sm bg-muted/30 p-3 text-sm md:flex-row md:items-center">
            <p className="flex-1">
              Ao confirmar, a divisão é registrada e enviada para aprovação. Simulação, postagem e
              estorno continuam protegidos no fluxo avançado.
            </p>
            <Button
              disabled={
                !canManage ||
                !source ||
                selectedUnits.length === 0 ||
                (method === "fixed_percentage" && Math.abs(percentageTotal - 100) > 0.0001) ||
                mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Confirmando…" : "Confirmar divisão"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
