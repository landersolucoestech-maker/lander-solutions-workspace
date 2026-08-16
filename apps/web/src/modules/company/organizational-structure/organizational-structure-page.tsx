import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { EmptyRow, Kpi, PageHeader, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { deleteOrganizationalRow, listOrganizationalDirectory, saveOrganizationalRow } from "./api";
import type { OrganizationalDirectory, OrganizationalEntityKind, OrganizationalRow } from "./types";

const pageSize = 8;
const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

interface SectionDefinition {
  kind: OrganizationalEntityKind;
  title: string;
  description: string;
  singular: string;
  rows: (data: OrganizationalDirectory) => OrganizationalRow[];
}

const sections: SectionDefinition[] = [
  {
    kind: "legal_entities",
    title: "Entidades jurídicas",
    description: "Pessoas jurídicas que sustentam a operação e as unidades de negócio.",
    singular: "entidade jurídica",
    rows: (data) => data.legalEntities,
  },
  {
    kind: "departments",
    title: "Departamentos",
    description: "Áreas internas, hierarquias e responsáveis da organização.",
    singular: "departamento",
    rows: (data) => data.departments,
  },
  {
    kind: "positions",
    title: "Cargos",
    description: "Cargos organizacionais consumidos pelo RH sem cadastro duplicado.",
    singular: "cargo",
    rows: (data) => data.positions,
  },
  {
    kind: "products",
    title: "Produtos",
    description: "Produtos próprios ou administrados pelas unidades de negócio.",
    singular: "produto",
    rows: (data) => data.products,
  },
  {
    kind: "service_lines",
    title: "Linhas de serviço",
    description: "Serviços prestados e suas responsabilidades internas.",
    singular: "linha de serviço",
    rows: (data) => data.serviceLines,
  },
  {
    kind: "projects",
    title: "Projetos",
    description: "Iniciativas com vigência, patrocínio e centros financeiros vinculados.",
    singular: "projeto",
    rows: (data) => data.projects,
  },
  {
    kind: "cost_centers",
    title: "Centros de custo",
    description: "Cadastro organizacional consumido pelo Financeiro e pelos rateios.",
    singular: "centro de custo",
    rows: (data) => data.costCenters,
  },
  {
    kind: "revenue_centers",
    title: "Centros de receita",
    description: "Cadastro organizacional utilizado na classificação de receitas.",
    singular: "centro de receita",
    rows: (data) => data.revenueCenters,
  },
];

const primarySectionKinds: OrganizationalEntityKind[] = [
  "service_lines",
  "products",
  "legal_entities",
  "departments",
  "positions",
];
const primarySections = sections.filter((section) => primarySectionKinds.includes(section.kind));
const secondarySections = sections.filter((section) => !primarySectionKinds.includes(section.kind));

function emptyForm(
  kind: OrganizationalEntityKind,
  data: OrganizationalDirectory,
): Record<string, string> {
  const legalEntityId = data.legalEntities[0]?.id ?? "";
  const businessUnitId = data.businessUnits[0]?.id ?? "";
  const common: Record<string, string> = {
    code: "",
    name: "",
    description: "",
    status: "active",
    legal_entity_id: legalEntityId,
    business_unit_id: businessUnitId,
    starts_on: "",
    ends_on: "",
    notes: "",
  };

  if (kind === "legal_entities") {
    return {
      code: "",
      legal_name: "",
      trade_name: "",
      registration_number: "",
      country_code: "BR",
      base_currency_code: "BRL",
      timezone: "America/Sao_Paulo",
      status: "active",
    };
  }

  if (kind === "business_units") {
    return {
      ...common,
      slug: "",
      email: "",
      phone: "",
      website: "",
    };
  }

  if (kind === "positions") {
    return {
      ...common,
      department_id: "",
      level: "",
      employment_type: "",
    };
  }

  if (kind === "projects") {
    return {
      ...common,
      product_id: "",
      service_line_id: "",
      cost_center_id: "",
      revenue_center_id: "",
      sponsor_user_id: "",
      start_date: "",
      end_date: "",
    };
  }

  if (kind === "departments") {
    return { ...common, parent_id: "", manager_user_id: "" };
  }

  return { ...common, parent_id: "", owner_user_id: "" };
}

function rowName(row: OrganizationalRow) {
  return String(row.name || row.trade_name || row.legal_name || row.code || row.id);
}

function nullable(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function dateLabel(value: unknown) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${String(value).slice(0, 10)}T12:00:00`),
  );
}

export function OrganizationalStructurePage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const readPermission = useQuery({
    queryKey: ["permission", "organizational_structure.read"],
    queryFn: () => hasPermission("organizational_structure.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "organizational_structure.manage"],
    queryFn: () => hasPermission("organizational_structure.manage"),
    enabled: Boolean(session && user),
  });
  const canRead = Boolean(session && user && readPermission.data === true);
  const canManage = Boolean(session && user && managePermission.data === true);
  const query = useQuery({
    queryKey: ["organizational-structure-directory"],
    queryFn: listOrganizationalDirectory,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organizational-structure-directory"] });
      toast.success("Estrutura organizacional atualizada.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha na estrutura organizacional."),
  });

  const [activeKind, setActiveKind] = useState<OrganizationalEntityKind>("service_lines");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationalRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const data = query.data;
  const definition = sections.find((section) => section.kind === activeKind) ?? sections[0];
  const visibleRows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return definition
      .rows(data)
      .filter((row) =>
        [row.code, row.name, row.legal_name, row.trade_name, row.description, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
  }, [data, definition, search]);

  if (query.error) {
    return <p className="p-6 text-sm text-destructive">{query.error.message}</p>;
  }
  if (query.isLoading || !data) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Carregando estrutura organizacional...</p>
    );
  }

  const totalRecords = sections.reduce((total, section) => total + section.rows(data).length, 0);
  const activeUnits = data.businessUnits.filter((row) => row.status === "active").length;
  const activeServices = data.serviceLines.filter((row) => row.status === "active").length;
  const activeProducts = data.products.filter((row) => row.status === "active").length;
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);

  const optionName = (rows: OrganizationalRow[], id: unknown) => {
    if (!id) return "—";
    return rowName(rows.find((row) => row.id === id) ?? { id: String(id) });
  };

  const openEditor = (row?: OrganizationalRow) => {
    setEditing(row ?? null);
    if (!row) {
      setForm(emptyForm(activeKind, data));
    } else {
      const next: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        next[key] = value === null || value === undefined ? "" : String(value);
      });
      setForm(next);
    }
    setEditorOpen(true);
  };

  const save = async () => {
    const values: Record<string, unknown> = {};
    Object.entries(form).forEach(([key, value]) => {
      if (["id", "version", "created_at", "updated_at", "created_by", "updated_by"].includes(key)) {
        return;
      }
      if (
        key.endsWith("_id") ||
        [
          "starts_on",
          "ends_on",
          "start_date",
          "end_date",
          "trade_name",
          "description",
          "notes",
          "email",
          "phone",
          "website",
          "level",
          "employment_type",
        ].includes(key)
      ) {
        values[key] = nullable(value);
      } else {
        values[key] = key === "code" ? value.trim().toUpperCase() : value.trim();
      }
    });

    await mutation.mutateAsync(() =>
      saveOrganizationalRow(activeKind, editing?.id ?? null, editing?.version, values),
    );
    setEditorOpen(false);
  };

  const remove = (row: OrganizationalRow) => {
    if (
      !window.confirm(`Excluir ${rowName(row)}? Dependências existentes podem impedir a operação.`)
    ) {
      return;
    }
    mutation.mutate(() => deleteOrganizationalRow(activeKind, row.id));
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Cadastros da Empresa"
        description="Cadastros estruturais que sustentam os serviços próprios e as unidades de negócio da Lander Solutions. Unidades possuem uma experiência econômica própria e não são duplicadas aqui."
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <section className="rounded-sm border bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 text-primary" />
            <div className="space-y-2">
              <div>
                <h2 className="font-semibold">Unidades de Negócio</h2>
                <p className="text-sm text-muted-foreground">
                  Negócios com acompanhamento econômico próprio, como Music OS 360 e Vivendo da
                  Música.
                </p>
              </div>
              <Button size="sm" asChild>
                <Link to="/unidades">
                  Abrir unidades <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="rounded-sm border p-4">
          <h2 className="font-semibold">Cadastros administrativos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esses registros sustentam a operação, mas não representam automaticamente uma unidade
            com resultado próprio. Produtos auxiliares e linhas de serviço permanecem vinculados a
            uma unidade.
          </p>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Serviços próprios ativos" value={String(activeServices)} />
        <Kpi label="Produtos ativos" value={String(activeProducts)} />
        <Kpi label="Unidades ativas" value={String(activeUnits)} />
        <Kpi label="Cadastros de suporte" value={String(totalRecords)} />
      </div>

      <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Separação obrigatória:</strong> sócios, capital social, quotas e beneficiários
        finais pertencem exclusivamente à Estrutura Societária.
      </div>

      {!canRead && !canManage && (
        <p className="text-sm text-muted-foreground">
          Estrutura disponível em modo consultivo; alterações exigem autorização organizacional.
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Estrutura essencial</h2>
          <p className="text-sm text-muted-foreground">
            Serviços e produtos próprios aparecem primeiro; entidades, departamentos e cargos dão
            suporte administrativo à operação.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {primarySections.map((section) => (
            <Button
              key={section.kind}
              type="button"
              variant={activeKind === section.kind ? "default" : "outline"}
              className="h-auto justify-start py-3 text-left"
              onClick={() => {
                setActiveKind(section.kind);
                setSearch("");
                setPage(1);
              }}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>
                <span className="block font-medium">{section.title}</span>
                <span className="block text-xs font-normal opacity-80">
                  {section.rows(data).length} registro(s)
                </span>
              </span>
            </Button>
          ))}
        </div>
      </section>

      <details className="rounded-sm border bg-muted/20">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Cadastros financeiros e projetos vinculados
        </summary>
        <div className="border-t p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Projetos e centros permanecem disponíveis como referências administrativas, sem competir
            com serviços, produtos e unidades na experiência principal.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {secondarySections.map((section) => (
              <Button
                key={section.kind}
                type="button"
                variant={activeKind === section.kind ? "default" : "outline"}
                className="h-auto justify-start py-3 text-left"
                onClick={() => {
                  setActiveKind(section.kind);
                  setSearch("");
                  setPage(1);
                }}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-medium">{section.title}</span>
                  <span className="block text-xs font-normal opacity-80">
                    {section.rows(data).length} registro(s)
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      </details>

      <section className="rounded-sm border">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-semibold">{definition.title}</h2>
            <p className="text-sm text-muted-foreground">{definition.description}</p>
          </div>
          <div className="flex flex-1 flex-col gap-2 md:ml-auto md:max-w-xl md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={`Buscar ${definition.title.toLowerCase()}`}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button disabled={!canManage} onClick={() => openEditor()}>
              <Plus className="h-4 w-4" /> Novo registro
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <Th>Código / nome</Th>
                <Th>Entidade</Th>
                <Th>Unidade / vínculo</Th>
                <Th>Responsável</Th>
                <Th>Vigência</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <EmptyRow colSpan={7} label={`Nenhum registro em ${definition.title}.`} />
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <Td>
                    <strong>{row.code || "—"}</strong>
                    <div>{rowName(row)}</div>
                    {row.description && (
                      <div className="max-w-xs truncate text-xs text-muted-foreground">
                        {String(row.description)}
                      </div>
                    )}
                  </Td>
                  <Td>{optionName(data.legalEntities, row.legal_entity_id)}</Td>
                  <Td>
                    {optionName(data.businessUnits, row.business_unit_id)}
                    {row.department_id && (
                      <div className="text-xs text-muted-foreground">
                        {optionName(data.departments, row.department_id)}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {optionName(
                      data.profiles.map((profile) => ({ id: profile.id, name: profile.name })),
                      row.manager_user_id || row.owner_user_id || row.sponsor_user_id,
                    )}
                  </Td>
                  <Td>
                    {dateLabel(row.starts_on || row.start_date)} —{" "}
                    {dateLabel(row.ends_on || row.end_date)}
                  </Td>
                  <Td>
                    <StatusPill status={String(row.status || "active")} />
                  </Td>
                  <Td>
                    {canManage && (
                      <div className="flex gap-1">
                        <IconButton label="Editar registro" onClick={() => openEditor(row)}>
                          <Pencil />
                        </IconButton>
                        {!row.is_system && (
                          <IconButton
                            label="Excluir registro"
                            destructive
                            onClick={() => remove(row)}
                          >
                            <Trash2 />
                          </IconButton>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={visibleRows.length} onChange={setPage} />
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar ${definition.singular}` : `Nova ${definition.singular}`}
            </DialogTitle>
            <DialogDescription>
              Alterações exigem MFA e respeitam o escopo da entidade ou unidade de negócio.
            </DialogDescription>
          </DialogHeader>
          <EntityFields kind={activeKind} form={form} setForm={setForm} data={data} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !canManage || mutation.isPending || !requiredFieldsPresent(activeKind, form)
              }
              onClick={save}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function requiredFieldsPresent(kind: OrganizationalEntityKind, form: Record<string, string>) {
  if (kind === "legal_entities") return Boolean(form.code?.trim() && form.legal_name?.trim());
  if (kind === "positions")
    return Boolean(form.code?.trim() && form.name?.trim() && form.business_unit_id);
  return Boolean(form.code?.trim() && form.name?.trim() && form.legal_entity_id);
}

function EntityFields({
  kind,
  form,
  setForm,
  data,
}: {
  kind: OrganizationalEntityKind;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  data: OrganizationalDirectory;
}) {
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const profileOptions = data.profiles.map((profile) => ({ id: profile.id, name: profile.name }));

  if (kind === "legal_entities") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Código" value={form.code} onChange={(value) => set("code", value)} />
        <TextField
          label="Razão social"
          value={form.legal_name}
          onChange={(value) => set("legal_name", value)}
        />
        <TextField
          label="Nome fantasia"
          value={form.trade_name}
          onChange={(value) => set("trade_name", value)}
        />
        <TextField
          label="Número de registro"
          value={form.registration_number}
          onChange={(value) => set("registration_number", value)}
        />
        <TextField
          label="País"
          value={form.country_code}
          onChange={(value) => set("country_code", value)}
        />
        <TextField
          label="Moeda base"
          value={form.base_currency_code}
          onChange={(value) => set("base_currency_code", value)}
        />
        <TextField
          label="Fuso horário"
          value={form.timezone}
          onChange={(value) => set("timezone", value)}
        />
        <StatusField value={form.status} onChange={(value) => set("status", value)} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {kind !== "positions" && (
        <SelectField
          label="Entidade jurídica"
          value={form.legal_entity_id}
          options={data.legalEntities}
          onChange={(value) => set("legal_entity_id", value)}
        />
      )}
      <SelectField
        label="Unidade de negócio"
        value={form.business_unit_id}
        options={data.businessUnits}
        allowEmpty={kind === "business_units"}
        onChange={(value) => set("business_unit_id", value)}
      />
      <TextField label="Código" value={form.code} onChange={(value) => set("code", value)} />
      <TextField label="Nome" value={form.name} onChange={(value) => set("name", value)} />

      {kind === "business_units" && (
        <>
          <TextField label="Slug" value={form.slug} onChange={(value) => set("slug", value)} />
          <TextField label="E-mail" value={form.email} onChange={(value) => set("email", value)} />
          <TextField
            label="Telefone"
            value={form.phone}
            onChange={(value) => set("phone", value)}
          />
          <TextField
            label="Website"
            value={form.website}
            onChange={(value) => set("website", value)}
          />
        </>
      )}

      {kind === "departments" && (
        <>
          <SelectField
            label="Departamento superior"
            value={form.parent_id}
            options={data.departments}
            allowEmpty
            onChange={(value) => set("parent_id", value)}
          />
          <SelectField
            label="Gestor"
            value={form.manager_user_id}
            options={profileOptions}
            allowEmpty
            onChange={(value) => set("manager_user_id", value)}
          />
        </>
      )}

      {kind === "positions" && (
        <>
          <SelectField
            label="Departamento"
            value={form.department_id}
            options={data.departments}
            allowEmpty
            onChange={(value) => set("department_id", value)}
          />
          <TextField label="Nível" value={form.level} onChange={(value) => set("level", value)} />
          <TextField
            label="Tipo de contratação"
            value={form.employment_type}
            onChange={(value) => set("employment_type", value)}
          />
        </>
      )}

      {kind === "projects" && (
        <>
          <SelectField
            label="Produto"
            value={form.product_id}
            options={data.products}
            allowEmpty
            onChange={(value) => set("product_id", value)}
          />
          <SelectField
            label="Linha de serviço"
            value={form.service_line_id}
            options={data.serviceLines}
            allowEmpty
            onChange={(value) => set("service_line_id", value)}
          />
          <SelectField
            label="Centro de custo"
            value={form.cost_center_id}
            options={data.costCenters}
            allowEmpty
            onChange={(value) => set("cost_center_id", value)}
          />
          <SelectField
            label="Centro de receita"
            value={form.revenue_center_id}
            options={data.revenueCenters}
            allowEmpty
            onChange={(value) => set("revenue_center_id", value)}
          />
          <SelectField
            label="Patrocinador"
            value={form.sponsor_user_id}
            options={profileOptions}
            allowEmpty
            onChange={(value) => set("sponsor_user_id", value)}
          />
          <DateField
            label="Início"
            value={form.start_date}
            onChange={(value) => set("start_date", value)}
          />
          <DateField
            label="Fim"
            value={form.end_date}
            onChange={(value) => set("end_date", value)}
          />
        </>
      )}

      {["products", "service_lines", "cost_centers", "revenue_centers"].includes(kind) && (
        <>
          <SelectField
            label="Responsável"
            value={form.owner_user_id}
            options={profileOptions}
            allowEmpty
            onChange={(value) => set("owner_user_id", value)}
          />
          {(kind === "cost_centers" || kind === "revenue_centers") && (
            <SelectField
              label="Centro superior"
              value={form.parent_id}
              options={kind === "cost_centers" ? data.costCenters : data.revenueCenters}
              allowEmpty
              onChange={(value) => set("parent_id", value)}
            />
          )}
        </>
      )}

      {kind !== "projects" && (
        <>
          <DateField
            label="Início da vigência"
            value={form.starts_on}
            onChange={(value) => set("starts_on", value)}
          />
          <DateField
            label="Fim da vigência"
            value={form.ends_on}
            onChange={(value) => set("ends_on", value)}
          />
        </>
      )}
      <StatusField value={form.status} onChange={(value) => set("status", value)} />
      <div className="md:col-span-2">
        <Field label="Descrição">
          <Textarea
            value={form.description ?? ""}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
      </div>
      {kind !== "positions" && (
        <div className="md:col-span-2">
          <Field label="Notas">
            <Textarea
              value={form.notes ?? ""}
              onChange={(event) => set("notes", event.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
  allowEmpty,
}: {
  label: string;
  value?: string;
  options: Array<{
    id: string;
    name?: string;
    legal_name?: string;
    trade_name?: string | null;
    code?: string;
  }>;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        className={fieldClass}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty && <option value="">Não vinculado</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name || option.trade_name || option.legal_name || option.code || option.id}
          </option>
        ))}
      </select>
    </Field>
  );
}
function StatusField({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return (
    <Field label="Status">
      <select
        className={fieldClass}
        value={value ?? "active"}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="active">Ativo</option>
        <option value="inactive">Inativo</option>
        <option value="planned">Planejado</option>
        <option value="closed">Encerrado</option>
        <option value="archived">Arquivado</option>
      </select>
    </Field>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
function IconButton({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      className={destructive ? "text-destructive" : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t p-3 text-sm">
      <span>{total} registro(s)</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <span>
          Página {page} de {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
