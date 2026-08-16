import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Eye,
  FileImage,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { hasPermission } from "@/modules/access-control/api";
import {
  listBusinessUnits,
  type BusinessUnit,
} from "@/modules/company/organizational-structure/business-units";
import {
  createContractTemplate,
  createContractTemplateImageUrl,
  deleteContractTemplate,
  listContractTemplates,
  removeContractTemplateImages,
  updateContractTemplate,
  uploadContractTemplateImage,
} from "@/modules/contracts/api";
import {
  CONTRACT_TEMPLATE_IMAGE_ACCEPT,
  validateContractTemplateImage,
  type ContractTemplateImageSlot,
} from "@/modules/contracts/contract-template-assets";
import { ContractTemplatePreview } from "@/modules/contracts/components/contract-template-preview";
import {
  CONTRACT_TEMPLATE_VARIABLE_GROUPS,
  CONTRACT_TEMPLATE_VARIABLE_REGISTRY,
} from "@/modules/contracts/contract-template-variable-registry";
import {
  CONTRACT_TEMPLATE_VARIABLE_TYPES,
  extractPlaceholders,
  findUnresolvedTemplatePlaceholders,
  isRolePlaceholder,
  normalizeManifest,
  normalizeTemplateVariable,
  normalizeVariableKey,
} from "@/modules/contracts/contract-template-workspace";
import type {
  ContractTemplate,
  ContractTemplateImageAlignment,
  ContractTemplateVariable,
} from "@/modules/contracts/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { EmptyRow, PageHeader, StatusPill } from "@/shared/components/ui-kit";

type ModalState =
  | { action: "create" }
  | { action: "edit" | "duplicate" | "view" | "destroy"; record: ContractTemplate }
  | null;

export function ContractTemplatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);
  const templatesQuery = useQuery({
    queryKey: ["contract-templates"],
    queryFn: listContractTemplates,
  });
  const permissionQuery = useQuery({
    queryKey: ["permission", "contracts.documents.manage"],
    queryFn: () => hasPermission("contracts.documents.manage"),
  });
  const businessUnitsQuery = useQuery({
    queryKey: ["business-units", "contract-templates"],
    queryFn: listBusinessUnits,
  });
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const businessUnits = useMemo(() => businessUnitsQuery.data ?? [], [businessUnitsQuery.data]);
  const canManage = permissionQuery.data === true;
  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch = normalized
        ? `${template.code} ${template.name} ${template.contract_type}`
            .toLowerCase()
            .includes(normalized)
        : true;
      return (
        matchesSearch &&
        (typeFilter === "all" || template.contract_type === typeFilter) &&
        (statusFilter === "all" || template.status === statusFilter)
      );
    });
  }, [search, statusFilter, templates, typeFilter]);

  useEffect(() => {
    const openCreateWorkspace = () => setModal({ action: "create" });
    window.addEventListener("contract-templates:create", openCreateWorkspace);
    return () => window.removeEventListener("contract-templates:create", openCreateWorkspace);
  }, []);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
  }

  if (templatesQuery.isLoading || permissionQuery.isLoading || businessUnitsQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando templates contratuais…
      </div>
    );
  }

  if (templatesQuery.error || permissionQuery.error || businessUnitsQuery.error || !canManage) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title="Templates de contratos"
          description="Área restrita de configuração contratual."
        />
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {!canManage
            ? "Você não possui permissão para administrar templates contratuais."
            : templatesQuery.error instanceof Error
              ? templatesQuery.error.message
              : "Falha ao carregar os templates."}
        </div>
      </div>
    );
  }

  const modalKey = modal
    ? `${modal.action}-${"record" in modal ? modal.record.id : "new"}`
    : "closed";

  return (
    <div className="min-w-0 space-y-3 p-2 md:p-3">
      <section
        className="overflow-hidden rounded-sm border bg-card shadow-none"
        data-testid="contract-template-list-box"
      >
        <div className="grid gap-2 border-b bg-muted/20 p-2 sm:grid-cols-[minmax(220px,1fr)_180px_160px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou tipo"
            className="h-9 w-full rounded-sm"
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: "all", label: "Todos os tipos" }, ...CONTRACT_TYPE_OPTIONS]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Todas as situações" },
              { value: "active", label: "Ativo" },
              { value: "inactive", label: "Inativo" },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="label-caps">
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Unidade de negócio</th>
                <th className="px-3 py-2 text-left">Tipo contratual</th>
                <th className="px-3 py-2 text-left">Situação</th>
                <th className="px-3 py-2 text-left">Variáveis</th>
                <th className="px-3 py-2 text-left">Atualizado em</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7} label="Nenhum template cadastrado." />
              ) : null}
              {rows.map((template) => (
                <tr
                  key={template.id}
                  className="cursor-pointer border-t align-middle transition-colors hover:bg-muted/35 focus-within:bg-muted/35"
                  tabIndex={0}
                  onClick={() => setModal({ action: "view", record: template })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setModal({ action: "view", record: template });
                    }
                  }}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.code}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {businessUnitName(businessUnits, template.business_unit_id)}
                  </td>
                  <td className="px-3 py-2">{contractTypeLabel(template.contract_type)}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={template.status === "active" ? "Ativo" : "Inativo"} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {Array.isArray(template.variables_manifest)
                      ? template.variables_manifest.length
                      : 0}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatUpdatedAt(template.updated_at)}
                  </td>
                  <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Ações do template ${template.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => setModal({ action: "view", record: template })}
                          >
                            <Eye className="h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setModal({ action: "edit", record: template })}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setModal({ action: "duplicate", record: template })}
                          >
                            <Copy className="h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setModal({ action: "destroy", record: template })}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TemplateDialog
        key={modalKey}
        state={modal}
        onClose={() => setModal(null)}
        onChanged={refresh}
        businessUnits={businessUnits}
      />
    </div>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function TemplateDialog({
  state,
  onClose,
  onChanged,
  businessUnits,
}: {
  state: ModalState;
  onClose: () => void;
  onChanged: () => Promise<void>;
  businessUnits: BusinessUnit[];
}) {
  if (!state) return null;
  if (state.action === "destroy") {
    return <DeleteTemplateDialog template={state.record} onClose={onClose} onChanged={onChanged} />;
  }
  if (state.action === "view") {
    return (
      <ViewTemplateDialog template={state.record} businessUnits={businessUnits} onClose={onClose} />
    );
  }
  return (
    <TemplateWorkspaceDialog
      mode={state.action}
      source={state.action === "create" ? null : state.record}
      businessUnits={businessUnits}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function DeleteTemplateDialog({
  template,
  onClose,
  onChanged,
}: {
  template: ContractTemplate;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir template</DialogTitle>
          <DialogDescription>
            Templates vinculados a contratos não podem ser excluídos.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{template.name}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{template.code}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              void deleteContractTemplate(template.id)
                .then(onChanged)
                .then(() => {
                  toast.success("Template excluído.");
                  onClose();
                })
                .catch((error) =>
                  toast.error(error instanceof Error ? error.message : "Falha ao excluir."),
                )
                .finally(() => setSubmitting(false));
            }}
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewTemplateDialog({
  template,
  businessUnits,
  onClose,
}: {
  template: ContractTemplate;
  businessUnits: BusinessUnit[];
  onClose: () => void;
}) {
  const images = useTemplateImageUrls(template.header_image_path, template.footer_image_path);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-[94vw]">
        <div className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate">{template.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {businessUnitName(businessUnits, template.business_unit_id)} ·{" "}
                  {contractTypeLabel(template.contract_type)}
                </DialogDescription>
              </div>
              <StatusPill status={template.status === "active" ? "Ativo" : "Inativo"} />
            </div>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-3 sm:p-6">
          {images.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <ContractTemplatePreview
              title={template.name}
              headerText={template.header_text}
              bodyText={template.body_text}
              footerText={template.footer_text}
              headerImageUrl={images.headerUrl}
              footerImageUrl={images.footerUrl}
              headerImageAlignment={template.header_image_alignment}
              footerImageAlignment={template.footer_image_alignment}
              showHeading={false}
            />
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-card px-4 py-3 sm:px-6">
          <div className="mr-auto text-xs text-muted-foreground">
            Documento A4 · placeholders destacados
          </div>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateWorkspaceDialog({
  mode,
  source,
  businessUnits,
  onClose,
  onChanged,
}: {
  mode: "create" | "edit" | "duplicate";
  source: ContractTemplate | null;
  businessUnits: BusinessUnit[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const editing = mode === "edit";
  const duplicating = mode === "duplicate";
  const [templateId] = useState(() => (editing && source ? source.id : crypto.randomUUID()));
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState("document");
  const [businessUnitId, setBusinessUnitId] = useState(source?.business_unit_id ?? "");
  const [name, setName] = useState(
    duplicating ? `${source?.name ?? "Template"} — cópia` : (source?.name ?? ""),
  );
  const [contractType, setContractType] = useState(source?.contract_type ?? "service");
  const [bodyText, setBodyText] = useState(source?.body_text ?? "");
  const [headerAlignment, setHeaderAlignment] = useState<ContractTemplateImageAlignment>(
    source?.header_image_alignment ?? "center",
  );
  const [footerAlignment, setFooterAlignment] = useState<ContractTemplateImageAlignment>(
    source?.footer_image_alignment ?? "center",
  );
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [headerRemoved, setHeaderRemoved] = useState(duplicating);
  const [footerRemoved, setFooterRemoved] = useState(duplicating);
  const [variables, setVariables] = useState(() => normalizeManifest(source?.variables_manifest));
  const [partyRoles, setPartyRoles] = useState(source?.party_roles.join(", ") ?? "");
  const [signatureRoles, setSignatureRoles] = useState(source?.signature_roles.join(", ") ?? "");
  const [status, setStatus] = useState<ContractTemplate["status"]>(source?.status ?? "active");
  const [submitting, setSubmitting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const persistedImages = useTemplateImageUrls(
    headerRemoved || duplicating ? null : source?.header_image_path,
    footerRemoved || duplicating ? null : source?.footer_image_path,
  );
  const headerLocalUrl = useObjectUrl(headerFile);
  const footerLocalUrl = useObjectUrl(footerFile);
  const headerPreviewUrl = headerLocalUrl ?? persistedImages.headerUrl;
  const footerPreviewUrl = footerLocalUrl ?? persistedImages.footerUrl;
  const placeholders = useMemo(() => extractPlaceholders(bodyText), [bodyText]);
  const manifestKeys = useMemo(
    () =>
      new Set(
        variables.filter((variable) => variable.active !== false).map((variable) => variable.key),
      ),
    [variables],
  );
  const normalizedPartyRoles = splitList(partyRoles).map(normalizeRole);
  const normalizedSignatureRoles = splitList(signatureRoles).map(normalizeRole);
  const unmanifested = findUnresolvedTemplatePlaceholders(
    placeholders,
    manifestKeys,
    normalizedPartyRoles,
    normalizedSignatureRoles,
  );

  function insertVariable(key: string) {
    const placeholder = `{{${key}}}`;
    const editor = editorRef.current;
    if (!editor) {
      setBodyText((current) => `${current}${placeholder}`);
      return;
    }
    const start = editor.selectionStart ?? bodyText.length;
    const end = editor.selectionEnd ?? bodyText.length;
    setBodyText(`${bodyText.slice(0, start)}${placeholder}${bodyText.slice(end)}`);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  function insertRegistryVariable(variable: ContractTemplateVariable) {
    setVariables((current) =>
      current.some((item) => item.key === variable.key) ? current : [...current, { ...variable }],
    );
    insertVariable(variable.key);
  }

  async function selectImage(slot: ContractTemplateImageSlot, file: File | null) {
    setImageError(null);
    if (!file) return;
    try {
      await validateContractTemplateImage(file);
      if (slot === "header") {
        setHeaderFile(file);
        setHeaderRemoved(false);
      } else {
        setFooterFile(file);
        setFooterRemoved(false);
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Imagem inválida.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessUnitId || !name.trim() || !contractType) {
      toast.error("Preencha unidade de negócio, nome e tipo contratual.");
      return;
    }
    setSubmitting(true);
    setImageError(null);
    const uploaded: string[] = [];
    try {
      const nextHeaderPath = headerFile
        ? await uploadContractTemplateImage(templateId, "header", headerFile)
        : headerRemoved
          ? null
          : (source?.header_image_path ?? null);
      if (headerFile && nextHeaderPath) uploaded.push(nextHeaderPath);

      const nextFooterPath = footerFile
        ? await uploadContractTemplateImage(templateId, "footer", footerFile)
        : footerRemoved
          ? null
          : (source?.footer_image_path ?? null);
      if (footerFile && nextFooterPath) uploaded.push(nextFooterPath);

      const values = {
        ...(!editing ? { id: templateId } : {}),
        business_unit_id: businessUnitId,
        code: editing && source ? source.code : generateTemplateCode(name, templateId),
        name: name.trim(),
        contract_type: contractType,
        body_text: bodyText,
        header_image_path: nextHeaderPath,
        footer_image_path: nextFooterPath,
        header_image_alignment: headerAlignment,
        footer_image_alignment: footerAlignment,
        variables_manifest: variables.map(normalizeTemplateVariable),
        party_roles: normalizedPartyRoles,
        signature_roles: normalizedSignatureRoles,
        status,
        ...(duplicating && source
          ? {
              description: source.description,
              header_text: source.header_text,
              footer_text: source.footer_text,
              default_calculation_basis: source.default_calculation_basis,
              default_included_components: source.default_included_components,
              default_excluded_components: source.default_excluded_components,
              default_loss_rule: source.default_loss_rule,
              default_investment_rule: source.default_investment_rule,
            }
          : {}),
      };

      if (editing && source) await updateContractTemplate(source.id, source.version, values);
      else await createContractTemplate(values);

      const stalePaths =
        editing && source
          ? [
              source.header_image_path !== nextHeaderPath ? source.header_image_path : null,
              source.footer_image_path !== nextFooterPath ? source.footer_image_path : null,
            ]
          : [];
      try {
        await removeContractTemplateImages(stalePaths);
      } catch {
        toast.warning("Template salvo, mas um arquivo antigo não pôde ser removido.");
      }

      await onChanged();
      toast.success(
        editing ? "Template atualizado." : duplicating ? "Template duplicado." : "Template criado.",
      );
      onClose();
    } catch (error) {
      try {
        await removeContractTemplateImages(uploaded);
      } catch {
        /* limpeza best-effort */
      }
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o template.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="h-[min(88vh,860px)] w-[calc(100vw-1rem)] max-w-[1100px] overflow-hidden p-0 sm:w-[95vw]">
        <form className="flex h-full min-h-0 flex-col" onSubmit={submit}>
          <div className="border-b px-4 py-4 pr-12 sm:px-6">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar template" : duplicating ? "Duplicar template" : "Novo template"}
              </DialogTitle>
              <DialogDescription>
                Configure o documento e acompanhe o preview A4 em tempo real.
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 border-b px-4 py-3 sm:px-6">
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-full p-1 sm:w-auto">
                <TabsTrigger value="document" className="rounded-full">
                  Documento
                </TabsTrigger>
                <TabsTrigger value="variables" className="rounded-full">
                  Variáveis
                </TabsTrigger>
                <TabsTrigger value="parties" className="rounded-full">
                  Partes e assinaturas
                </TabsTrigger>
                <TabsTrigger value="identity" className="rounded-full">
                  Identidade visual
                </TabsTrigger>
                <TabsTrigger value="preview" className="rounded-full">
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <TabsContent value="document" className="mt-0 space-y-4">
                <section className="rounded-sm border bg-muted/10 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Informações básicas</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Identificação essencial do modelo documental.
                      </p>
                    </div>
                    <StatusPill status={status === "active" ? "Ativo" : "Inativo"} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Unidade de negócio">
                      <Select
                        value={businessUnitId}
                        onChange={setBusinessUnitId}
                        placeholder="Selecione a unidade de negócio"
                        options={businessUnits
                          .filter((unit) => unit.status === "active" || unit.id === businessUnitId)
                          .map((unit) => ({
                            value: unit.id,
                            label: `${unit.name} · ${unit.code}`,
                          }))}
                      />
                    </Field>
                    <Field label="Nome do template">
                      <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Contrato de prestação de serviços"
                        required
                      />
                    </Field>
                    <Field label="Tipo contratual">
                      <Select
                        value={contractType}
                        onChange={setContractType}
                        options={CONTRACT_TYPE_OPTIONS}
                      />
                    </Field>
                    <Field label="Situação">
                      <Select
                        value={status}
                        onChange={(value) => setStatus(value as ContractTemplate["status"])}
                        options={[
                          { value: "active", label: "Ativo" },
                          { value: "inactive", label: "Inativo" },
                        ]}
                      />
                    </Field>
                  </div>
                </section>

                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <WorkspaceSection
                    title="Conteúdo do contrato"
                    description="Escreva aqui o modelo do documento e insira variáveis quando necessário."
                  >
                    <textarea
                      ref={editorRef}
                      value={bodyText}
                      onChange={(event) => setBodyText(event.target.value)}
                      rows={22}
                      placeholder="Escreva o conteúdo do contrato. Use {{GRUPO.CAMPO}} para dados dinâmicos."
                      className="w-full min-w-0 resize-y rounded-sm border bg-background px-4 py-3 text-sm leading-relaxed"
                      data-testid="contract-template-body"
                    />
                  </WorkspaceSection>
                  <VariableLibrary
                    variables={variables}
                    placeholders={placeholders}
                    onInsert={insertRegistryVariable}
                  />
                </div>
              </TabsContent>

              <TabsContent value="variables" className="mt-0">
                <WorkspaceSection
                  title="Variáveis do documento"
                  description="Campos dinâmicos substituídos pelos dados do contrato quando o documento é preparado."
                >
                  <VariableEditor
                    variables={variables}
                    onChange={setVariables}
                    onInsert={insertVariable}
                  />
                  <PlaceholderSummary
                    placeholders={placeholders}
                    manifestKeys={manifestKeys}
                    partyRoles={normalizedPartyRoles}
                    signatureRoles={normalizedSignatureRoles}
                    unresolved={unmanifested}
                  />
                </WorkspaceSection>
              </TabsContent>

              <TabsContent value="parties" className="mt-0">
                <div className="grid gap-5 lg:grid-cols-2">
                  <WorkspaceSection
                    title="Papéis das partes"
                    description="Informe os papéis empresariais esperados no contrato, separados por vírgula ou linha."
                  >
                    <Textarea
                      value={partyRoles}
                      onChange={setPartyRoles}
                      rows={8}
                      placeholder="CONTRATANTE, CONTRATADA"
                    />
                  </WorkspaceSection>
                  <WorkspaceSection
                    title="Papéis dos signatários"
                    description="Informe quem deverá assinar o documento, sem cadastrar pessoas neste momento."
                  >
                    <Textarea
                      value={signatureRoles}
                      onChange={setSignatureRoles}
                      rows={8}
                      placeholder="REPRESENTANTE, TESTEMUNHA"
                    />
                  </WorkspaceSection>
                </div>
              </TabsContent>

              <TabsContent value="identity" className="mt-0">
                <WorkspaceSection
                  title="Identidade visual do documento"
                  description="Configure as imagens exibidas no topo e na base da página."
                >
                  <div className="grid gap-5 lg:grid-cols-2">
                    <ImageField
                      slot="header"
                      label="Imagem de cabeçalho"
                      previewUrl={headerPreviewUrl}
                      fileName={headerFile?.name}
                      alignment={headerAlignment}
                      onAlignmentChange={setHeaderAlignment}
                      onSelect={(file) => void selectImage("header", file)}
                      onRemove={() => {
                        setHeaderFile(null);
                        setHeaderRemoved(true);
                      }}
                    />
                    <ImageField
                      slot="footer"
                      label="Imagem de rodapé"
                      previewUrl={footerPreviewUrl}
                      fileName={footerFile?.name}
                      alignment={footerAlignment}
                      onAlignmentChange={setFooterAlignment}
                      onSelect={(file) => void selectImage("footer", file)}
                      onRemove={() => {
                        setFooterFile(null);
                        setFooterRemoved(true);
                      }}
                    />
                  </div>
                </WorkspaceSection>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <WorkspaceSection
                  title="Preview do documento"
                  description="Visualização A4 compartilhada com a consulta do template."
                >
                  {persistedImages.isLoading && !headerLocalUrl && !footerLocalUrl ? (
                    <div className="flex min-h-64 items-center justify-center">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <ContractTemplatePreview
                      title={name || "Novo template"}
                      headerText=""
                      bodyText={bodyText}
                      footerText=""
                      headerImageUrl={headerPreviewUrl}
                      footerImageUrl={footerPreviewUrl}
                      headerImageAlignment={headerAlignment}
                      footerImageAlignment={footerAlignment}
                    />
                  )}
                </WorkspaceSection>
              </TabsContent>
            </div>
          </Tabs>

          {imageError ? (
            <div className="border-t bg-destructive/5 px-4 py-2 text-sm text-destructive sm:px-6">
              {imageError}
            </div>
          ) : null}
          <DialogFooter className="border-t bg-card px-4 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                unmanifested.length > 0 ||
                !businessUnitId ||
                !name.trim() ||
                !contractType
              }
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Salvar
              template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImageField({
  slot,
  label,
  previewUrl,
  fileName,
  alignment,
  onAlignmentChange,
  onSelect,
  onRemove,
}: {
  slot: ContractTemplateImageSlot;
  label: string;
  previewUrl: string | null;
  fileName?: string;
  alignment: ContractTemplateImageAlignment;
  onAlignmentChange: (value: ContractTemplateImageAlignment) => void;
  onSelect: (file: File | null) => void;
  onRemove: () => void;
}) {
  const inputId = `${slot}-template-image`;
  return (
    <div className="space-y-3">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="rounded-sm border border-dashed p-3">
        {previewUrl ? (
          <div className="mb-3 flex min-h-28 items-center justify-center rounded-sm bg-muted/40 p-3">
            <img
              src={previewUrl}
              alt={`Preview da ${label.toLowerCase()}`}
              className="max-h-36 max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="mb-3 flex min-h-28 flex-col items-center justify-center gap-2 rounded-sm bg-muted/30 text-muted-foreground">
            <FileImage className="h-8 w-8 opacity-50" />
            <span className="text-xs">Nenhuma imagem selecionada</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            type="file"
            accept={CONTRACT_TEMPLATE_IMAGE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              onSelect(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              <Upload className="h-4 w-4" /> {previewUrl ? "Substituir" : "Selecionar imagem"}
            </label>
          </Button>
          {previewUrl ? (
            <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            PNG, JPEG ou WebP · até 2 MB{fileName ? ` · ${fileName}` : ""}
          </span>
        </div>
        <div
          className="mt-3 flex items-center gap-2"
          aria-label={`Alinhamento da ${label.toLowerCase()}`}
        >
          <span className="text-xs text-muted-foreground">Alinhamento:</span>
          {(["left", "center", "right"] as const).map((value) => {
            const Icon =
              value === "left" ? AlignLeft : value === "center" ? AlignCenter : AlignRight;
            return (
              <Button
                key={value}
                type="button"
                size="icon"
                variant={alignment === value ? "default" : "outline"}
                className="h-8 w-8"
                onClick={() => onAlignmentChange(value)}
                aria-label={`Alinhar ${value === "left" ? "à esquerda" : value === "center" ? "ao centro" : "à direita"}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VariableEditor({
  variables,
  onChange,
  onInsert,
}: {
  variables: ContractTemplateVariable[];
  onChange: (variables: ContractTemplateVariable[]) => void;
  onInsert: (key: string) => void;
}) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogGroup, setCatalogGroup] = useState("all");
  const configuredKeys = new Set(variables.map((variable) => variable.key));
  const catalogVariables = CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter(
    (variable) =>
      (catalogGroup === "all" || variable.group === catalogGroup) &&
      (!catalogSearch.trim() ||
        [variable.label, variable.key, variable.group, variable.source]
          .join(" ")
          .toLowerCase()
          .includes(catalogSearch.trim().toLowerCase())),
  );

  function update(index: number, patch: Partial<ContractTemplateVariable>) {
    onChange(
      variables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...patch } : variable,
      ),
    );
  }

  function addFromCatalog(variable: ContractTemplateVariable, insert: boolean) {
    if (!configuredKeys.has(variable.key)) onChange([...variables, { ...variable }]);
    if (insert) onInsert(variable.key);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-sm border bg-muted/15" data-testid="variable-catalog">
        <div className="border-b p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Biblioteca empresarial de variáveis</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Somente fontes sustentadas pelos owners reais e pelo resolver atual.
              </p>
            </div>
            <Badge variant="outline">Registry canônico</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Buscar variável, placeholder ou origem"
              aria-label="Buscar na biblioteca de variáveis"
            />
            <Select
              value={catalogGroup}
              onChange={setCatalogGroup}
              options={[
                { value: "all", label: "Todos os grupos" },
                ...CONTRACT_TEMPLATE_VARIABLE_GROUPS.map((group) => ({
                  value: group,
                  label: group,
                })),
              ]}
            />
          </div>
        </div>
        <div className="grid max-h-72 gap-2 overflow-y-auto p-3 lg:grid-cols-2">
          {catalogVariables.map((variable) => {
            const configured = configuredKeys.has(variable.key);
            return (
              <article key={variable.key} className="rounded-sm border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{variable.label}</p>
                    <code className="mt-1 block break-all text-[11px] text-primary">{`{{${variable.key}}}`}</code>
                  </div>
                  <Badge variant="secondary">{variable.group}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{variable.description}</p>
                <p className="mt-2 break-all text-[11px] text-muted-foreground">
                  Origem: <code>{variable.source}</code>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={configured ? "outline" : "default"}
                    onClick={() => addFromCatalog(variable, false)}
                    disabled={configured}
                  >
                    {configured ? "Configurada" : "Adicionar ao template"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addFromCatalog(variable, true)}
                  >
                    Inserir no conteúdo
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div>
        <h4 className="text-sm font-semibold">Variáveis configuradas neste template</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Alterações abaixo são persistidas no manifesto do template.
        </p>
      </div>
      {variables.map((variable, index) => (
        <div
          key={`${index}-${variable.key}`}
          className="grid gap-3 rounded-sm border p-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Chave / placeholder">
            <Input
              value={variable.key}
              onChange={(event) => update(index, { key: normalizeVariableKey(event.target.value) })}
              placeholder="CONTRATO.TITULO"
            />
          </Field>
          <Field label="Nome amigável">
            <Input
              value={variable.label}
              onChange={(event) => update(index, { label: event.target.value })}
            />
          </Field>
          <Field label="Grupo">
            <Input
              value={variable.group}
              onChange={(event) => update(index, { group: event.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={variable.type}
              onChange={(value) =>
                update(index, { type: value as ContractTemplateVariable["type"] })
              }
              options={CONTRACT_TEMPLATE_VARIABLE_TYPES.map((type) => ({
                value: type,
                label: type,
              }))}
            />
          </Field>
          <Field label="Origem do dado">
            <Input value={variable.source || "manual"} readOnly aria-readonly="true" />
          </Field>
          <Field label="Descrição" className="sm:col-span-2 lg:col-span-3">
            <Textarea
              value={variable.description ?? ""}
              onChange={(value) => update(index, { description: value })}
              rows={2}
              placeholder="Explique como esta variável deve ser preenchida."
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Checkbox
              id={`variable-required-${index}`}
              checked={variable.required}
              onCheckedChange={(checked) => update(index, { required: checked === true })}
            />
            <Label htmlFor={`variable-required-${index}`}>Obrigatória</Label>
            <Checkbox
              id={`variable-active-${index}`}
              checked={variable.active !== false}
              onCheckedChange={(checked) => update(index, { active: checked === true })}
            />
            <Label htmlFor={`variable-active-${index}`}>Ativa</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!variable.key}
              onClick={() => onInsert(variable.key)}
            >
              <Plus className="h-4 w-4" /> Inserir no documento
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() =>
                onChange(variables.filter((_, variableIndex) => variableIndex !== index))
              }
            >
              <X className="h-4 w-4" /> Remover
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...variables,
            {
              key: "",
              label: "",
              type: "text",
              required: false,
              group: "Contrato",
              source: "manual",
              description: "Preenchimento manual durante a preparação do contrato.",
              active: true,
            },
          ])
        }
      >
        <Plus className="h-4 w-4" /> Adicionar variável personalizada
      </Button>
    </div>
  );
}

function VariableLibrary({
  variables,
  placeholders,
  onInsert,
}: {
  variables: ContractTemplateVariable[];
  placeholders: string[];
  onInsert: (variable: ContractTemplateVariable) => void;
}) {
  const [search, setSearch] = useState("");
  const used = new Set(placeholders);
  const configured = new Set(variables.map((variable) => variable.key));
  const catalog = CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter(
    (variable) =>
      !search.trim() ||
      [variable.label, variable.key, variable.group]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <aside className="min-w-0 rounded-sm border bg-card">
      <div className="border-b p-4">
        <p className="text-xs font-semibold uppercase tracking-wide">Variáveis disponíveis</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clique para inserir na posição atual do editor.
        </p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar variável…"
          className="mt-3 h-8 text-xs"
        />
      </div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
        {catalog.length === 0 ? (
          <p className="rounded-sm border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhuma variável encontrada.
          </p>
        ) : null}
        {catalog.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => onInsert(variable)}
            className="flex w-full items-start justify-between gap-2 rounded-sm border p-3 text-left hover:bg-muted/50"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px]">{`{{${variable.key}}}`}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {variable.label || "Fonte não configurada"}
              </span>
            </span>
            <Badge variant={used.has(variable.key) ? "secondary" : "outline"}>
              {used.has(variable.key)
                ? "Em uso"
                : configured.has(variable.key)
                  ? "Inserir"
                  : "Adicionar"}
            </Badge>
          </button>
        ))}
      </div>
      <div className="border-t p-3">
        <Button type="button" variant="outline" size="sm" className="w-full" asChild>
          <a href="/configuracoes-variaveis-contratos">Configurar variáveis</a>
        </Button>
      </div>
    </aside>
  );
}

function PlaceholderSummary({
  placeholders,
  manifestKeys,
  partyRoles,
  signatureRoles,
  unresolved,
}: {
  placeholders: string[];
  manifestKeys: Set<string>;
  partyRoles: string[];
  signatureRoles: string[];
  unresolved: string[];
}) {
  return (
    <div className="rounded-sm border bg-muted/30 p-3">
      <p className="text-xs font-medium">Variáveis usadas no documento</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {placeholders.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nenhuma variável em uso.</span>
        ) : null}
        {placeholders.map((placeholder) => {
          const configured =
            manifestKeys.has(placeholder) ||
            isRolePlaceholder(placeholder, partyRoles, signatureRoles);
          return (
            <Badge key={placeholder} variant={configured ? "secondary" : "destructive"}>
              {`{{${placeholder}}}`} · {configured ? "configurada" : "fonte não configurada"}
            </Badge>
          );
        })}
      </div>
      {unresolved.length > 0 ? (
        <p className="mt-2 text-xs text-destructive">
          Configure a fonte das variáveis pendentes ou remova-as do documento.
        </p>
      ) : null}
    </div>
  );
}

function WorkspaceSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-sm border bg-card p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full min-w-0 resize-y rounded-sm border bg-background px-3 py-2 text-sm"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full min-w-0 rounded-sm border bg-background px-3 text-sm"
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function useTemplateImageUrls(
  headerPath: string | null | undefined,
  footerPath: string | null | undefined,
) {
  const query = useQuery({
    queryKey: ["contract-template-images", headerPath ?? null, footerPath ?? null],
    queryFn: async () => {
      const [headerUrl, footerUrl] = await Promise.all([
        createContractTemplateImageUrl(headerPath),
        createContractTemplateImageUrl(footerPath),
      ]);
      return { headerUrl, footerUrl };
    },
    enabled: Boolean(headerPath || footerPath),
    staleTime: 50 * 60 * 1000,
  });
  return {
    headerUrl: query.data?.headerUrl ?? null,
    footerUrl: query.data?.footerUrl ?? null,
    isLoading: query.isLoading,
  };
}

function normalizeRole(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

function generateTemplateCode(name: string, id: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${base || "TEMPLATE"}_${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const CONTRACT_TYPE_OPTIONS = [
  { value: "client", label: "Cliente" },
  { value: "supplier", label: "Fornecedor" },
  { value: "service", label: "Prestação de serviço" },
  { value: "participation", label: "Participação econômica" },
  { value: "investment", label: "Investimento" },
  { value: "partnership", label: "Parceria" },
  { value: "nda", label: "Confidencialidade" },
  { value: "employment", label: "Trabalho" },
  { value: "other", label: "Outro" },
] as const;

function contractTypeLabel(value: string) {
  return CONTRACT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function businessUnitName(units: BusinessUnit[], id: string | null) {
  if (!id) return "Não vinculada (template anterior)";
  return units.find((unit) => unit.id === id)?.name ?? "Unidade indisponível";
}
