import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { useWorkspace } from "@/app/providers/workspace-context";
import { hasPermission } from "@/modules/access-control/api";
import { loadUnitEconomicSnapshot } from "@/modules/finance/reports/unit-economics-queries";
import { EmptyRow, PageHeader, StatusPill } from "@/shared/components/ui-kit";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { listBusinessUnitDirectory, saveBusinessUnit } from "./api";
import type { BusinessUnit } from "./types";

interface UnitForm {
  legalEntityId: string;
  name: string;
  description: string;
  unitType: BusinessUnit["unit_type"];
  status: BusinessUnit["status"];
  currencyCode: string;
  responsibleUserId: string;
  startDate: string;
  endDate: string;
}

const emptyForm: UnitForm = {
  legalEntityId: "",
  name: "",
  description: "",
  unitType: "product",
  status: "active",
  currencyCode: "BRL",
  responsibleUserId: "",
  startDate: "",
  endDate: "",
};

const unitTypeLabel: Record<BusinessUnit["unit_type"], string> = {
  administrative: "Administrativa",
  product: "Produto ou negócio próprio",
  services: "Prestação de serviços",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function margin(value: number | null) {
  return value === null ? "Não disponível" : `${value.toFixed(1)}%`;
}

function unitTypeName(value: string) {
  return unitTypeLabel[value as BusinessUnit["unit_type"]] ?? value;
}

export function BusinessUnitsPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const { period } = useWorkspace();
  const query = useQuery({
    queryKey: ["business-unit-directory"],
    queryFn: listBusinessUnitDirectory,
    enabled: Boolean(session),
  });
  const economicsQuery = useQuery({
    queryKey: ["unit-economic-snapshot", period],
    queryFn: () => loadUnitEconomicSnapshot(period),
  });
  const permission = useQuery({
    queryKey: ["permission", "organizational_structure.manage"],
    queryFn: () => hasPermission("organizational_structure.manage"),
    enabled: Boolean(session && user),
  });
  const canManage = Boolean(session && user && permission.data === true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState<UnitForm>(emptyForm);

  const mutation = useMutation({
    mutationFn: () =>
      saveBusinessUnit(editing?.id ?? null, editing?.version ?? null, {
        legal_entity_id: form.legalEntityId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        unit_type: form.unitType,
        status: form.status,
        primary_currency_code: form.currencyCode,
        responsible_user_id: form.responsibleUserId || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-unit-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["unit-economic-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["organizational-structure-directory"] }),
      ]);
      setEditorOpen(false);
      toast.success(editing ? "Unidade atualizada." : "Unidade criada.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao salvar unidade."),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (economicsQuery.data?.units ?? []).filter(
      (unit) =>
        (status === "all" || unit.status === status) &&
        [unit.code, unit.name, unit.description, unit.legalEntityName, unitTypeName(unit.unitType)]
          .join(" ")
          .toLowerCase()
          .includes(term),
    );
  }, [economicsQuery.data?.units, search, status]);

  const directoryById = useMemo(
    () => new Map((query.data?.units ?? []).map((unit) => [unit.id, unit])),
    [query.data?.units],
  );
  const directory = query.data ?? { units: [], legalEntities: [], profiles: [] };

  function openEditor(unit?: BusinessUnit) {
    setEditing(unit ?? null);
    setForm(
      unit
        ? {
            legalEntityId: unit.legal_entity_id,
            name: unit.name,
            description: unit.description ?? "",
            unitType: unit.unit_type,
            status: unit.status,
            currencyCode: unit.primary_currency_code,
            responsibleUserId: unit.responsible_user_id ?? "",
            startDate: unit.start_date ?? "",
            endDate: unit.end_date ?? "",
          }
        : { ...emptyForm, legalEntityId: directory.legalEntities[0]?.id ?? "" },
    );
    setEditorOpen(true);
  }

  if ((session && query.isLoading) || economicsQuery.isLoading)
    return <p className="p-6 text-sm text-muted-foreground">Carregando unidades de negócio…</p>;
  if ((session && query.error) || economicsQuery.error || !economicsQuery.data) {
    return (
      <p className="p-6 text-sm text-destructive">
        {query.error instanceof Error
          ? query.error.message
          : economicsQuery.error instanceof Error
            ? economicsQuery.error.message
            : "Não foi possível carregar as unidades."}
      </p>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Produtos / Unidades"
        description="Centros econômicos da Lander Solutions com visão administrativa, financeira, fiscal, contratual, participações e repasses."
        actions={
          <Button disabled={!canManage} onClick={() => openEditor()}>
            <Plus className="h-4 w-4" /> Nova unidade
          </Button>
        }
      />

      {!canManage && (
        <p className="text-sm text-muted-foreground">
          {session
            ? "Consulta disponível. Criar ou editar exige MFA e permissão organizacional."
            : "A estrutura da página permanece disponível, mas os dados das unidades exigem uma sessão autorizada."}
        </p>
      )}

      <section className="rounded-sm border">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar unidade"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
              <SelectItem value="closed">Encerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-right">Custos</th>
                <th className="px-4 py-3 text-right">Resultado LANDER</th>
                <th className="px-4 py-3 text-right">Margem</th>
                <th className="px-4 py-3 text-right">Participações</th>
                <th className="px-4 py-3 text-right">Saldo de repasses</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={9}
                  label={
                    session
                      ? "Nenhuma unidade corresponde aos filtros."
                      : "Os dados cadastrais protegidos exigem sessão autorizada; o retrato econômico continua disponível quando houver lançamentos."
                  }
                />
              )}
              {rows.map((unit) => {
                const directoryUnit = directoryById.get(unit.id);
                return (
                  <tr key={unit.id} className="border-t">
                    <td className="px-4 py-3">
                      <strong>{unit.name}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {unit.code} · {unitTypeName(unit.unitType)}
                      </span>
                      {unit.legalEntityName && (
                        <span className="block text-xs text-muted-foreground">
                          {unit.legalEntityName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={unit.status} />
                    </td>
                    <MoneyCell available={unit.hasFinancialData} value={unit.revenue} />
                    <MoneyCell available={unit.hasFinancialData} value={unit.totalCost} />
                    <MoneyCell
                      available={unit.hasFinancialData}
                      value={unit.landerRetained}
                      tone={unit.landerRetained >= 0 ? "positive" : "negative"}
                    />
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {unit.hasFinancialData ? margin(unit.marginPercent) : "Não disponível"}
                    </td>
                    <MoneyCell
                      available={unit.hasParticipationData}
                      value={unit.participationExpenses}
                    />
                    <MoneyCell available={unit.hasPayoutData} value={unit.payoutPending} />
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canManage && directoryUnit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditor(directoryUnit)}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                        )}
                        <Button size="sm" asChild>
                          <Link to="/unidades/$unitId" params={{ unitId: unit.id }}>
                            Visualizar <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar unidade" : "Nova unidade de negócio"}</DialogTitle>
            <DialogDescription>
              Cadastre somente negócios que precisam de acompanhamento econômico próprio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entidade jurídica">
              <Select
                value={form.legalEntityId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, legalEntityId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {directory.legalEntities.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={form.unitType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    unitType: value as BusinessUnit["unit_type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(unitTypeLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as BusinessUnit["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                  <SelectItem value="closed">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moeda">
              <Input
                value={form.currencyCode}
                maxLength={3}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currencyCode: event.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
            <Field label="Responsável">
              <Select
                value={form.responsibleUserId || "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    responsibleUserId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
                  {directory.profiles.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Início">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </Field>
            <Field label="Encerramento">
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !canManage ||
                !form.legalEntityId ||
                form.name.trim().length < 2 ||
                mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Salvando…" : "Salvar unidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MoneyCell({
  value,
  available,
  tone = "default",
}: {
  value: number;
  available: boolean;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-destructive" : "";

  return (
    <td className={`px-4 py-3 text-right font-mono text-xs ${toneClass}`}>
      {available ? money(value) : "Não disponível"}
    </td>
  );
}
