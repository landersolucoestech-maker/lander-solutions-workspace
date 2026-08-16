import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
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
import { useWorkspace } from "@/app/providers/workspace-context";
import { createFiscalDocumentBundle, uploadFiscalPdf } from "./api";
import type { FiscalDirectory, FiscalDocumentBundleInput, FiscalDocumentItemInput } from "./types";

type OperationType = "entrada" | "saida";
type NoteType = "nfse" | "nfe" | "nfce";
type WorkflowStatus = "emitida" | "pendente" | "paga" | "cancelada";

interface FormState {
  operation_type: OperationType;
  numero: string;
  serie: string;
  tipo_nota: NoteType;
  cliente_id: string;
  natureza_operacao: string;
  codigo_servico_municipal: string;
  codigo_municipio: string;
  cfop: string;
  descricao_servicos: string;
  data_emissao: string;
  vencimento: string;
  status: WorkflowStatus;
  tomador_cnpj: string;
  tomador_razao_social: string;
  tomador_inscricao_estadual: string;
  tomador_inscricao_municipal: string;
  tomador_email: string;
  tomador_endereco: string;
  tomador_cidade: string;
  tomador_uf: string;
  tomador_cep: string;
  valor_servicos: number;
  valor_deducoes: number;
  base_calculo: number;
  aliquota_iss: number;
  valor_iss: number;
  iss_retido: boolean;
  valor_pis: number;
  valor_cofins: number;
  valor_inss: number;
  valor_ir: number;
  valor_csll: number;
  forma_pagamento: string;
  condicao_pagamento: string;
  itens: FiscalDocumentItemInput[];
  observacoes: string;
}

const serviceCodes = [
  ["12.07", "12.07 - Shows, festivais e congêneres"],
  ["12.13", "12.13 - Produção de eventos artísticos"],
  ["13.02", "13.02 - Fonografia ou gravação de sons"],
  ["10.05", "10.05 - Agenciamento, corretagem ou intermediação artística"],
  ["17.01", "17.01 - Assessoria, consultoria, gestão"],
  ["17.06", "17.06 - Propaganda e publicidade"],
] as const;

const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function initialForm(): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    operation_type: "saida",
    numero: "",
    serie: "001",
    tipo_nota: "nfse",
    cliente_id: "",
    natureza_operacao: "Prestação de Serviços Artísticos",
    codigo_servico_municipal: "12.07",
    codigo_municipio: "3550308",
    cfop: "5933",
    descricao_servicos: "",
    data_emissao: today,
    vencimento: today,
    status: "emitida",
    tomador_cnpj: "",
    tomador_razao_social: "",
    tomador_inscricao_estadual: "ISENTO",
    tomador_inscricao_municipal: "",
    tomador_email: "",
    tomador_endereco: "",
    tomador_cidade: "",
    tomador_uf: "SP",
    tomador_cep: "",
    valor_servicos: 0,
    valor_deducoes: 0,
    base_calculo: 0,
    aliquota_iss: 5,
    valor_iss: 0,
    iss_retido: false,
    valor_pis: 0,
    valor_cofins: 0,
    valor_inss: 0,
    valor_ir: 0,
    valor_csll: 0,
    forma_pagamento: "transferencia",
    condicao_pagamento: "30 dias",
    itens: [
      { description: "", service_code: "12.07", quantity: 1, unit_amount: 0, total_amount: 0 },
    ],
    observacoes: "",
  };
}

export function FiscalFormDialog({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: FiscalDirectory;
  onClose: () => void;
}) {
  const { unit } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const [pdf, setPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const businessUnit = useMemo(
    () =>
      data.fiscalBusinessUnits.find((item) => item.code === unit && item.status === "active") ??
      null,
    [data.fiscalBusinessUnits, unit],
  );
  const legalEntity = businessUnit
    ? (data.fiscalLegalEntities.find((item) => item.id === businessUnit.legal_entity_id) ?? null)
    : null;
  const parties = data.fiscalParties.filter((item) => item.status === "active");
  const netAmount = calculateNet(form);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectParty(partyId: string) {
    const party = parties.find((item) => item.id === partyId);
    const contact =
      data.fiscalPartyContacts.find(
        (item) =>
          item.party_id === partyId &&
          item.status === "active" &&
          item.contact_type === "email" &&
          item.is_primary,
      ) ??
      data.fiscalPartyContacts.find(
        (item) =>
          item.party_id === partyId && item.status === "active" && item.contact_type === "email",
      );
    const address =
      data.fiscalPartyAddresses.find(
        (item) => item.party_id === partyId && item.status === "active" && item.is_primary,
      ) ??
      data.fiscalPartyAddresses.find(
        (item) => item.party_id === partyId && item.status === "active",
      );
    setForm((current) => ({
      ...current,
      cliente_id: partyId,
      tomador_cnpj: party?.tax_id ?? "",
      tomador_razao_social: party?.trade_name?.trim() || party?.legal_name || "",
      tomador_email: contact?.value ?? "",
      tomador_endereco: address
        ? [address.address_line_1, address.address_line_2].filter(Boolean).join(", ")
        : "",
      tomador_cidade: address?.city ?? "",
      tomador_uf: address?.state_region ?? current.tomador_uf,
      tomador_cep: address?.postal_code ?? "",
    }));
  }

  function updateItem(index: number, key: keyof FiscalDocumentItemInput, value: string | number) {
    setForm((current) => {
      const items = current.itens.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [key]: value };
        next.total_amount = Number(next.quantity || 0) * Number(next.unit_amount || 0);
        return next;
      });
      const serviceAmount = items.reduce((sum, item) => sum + item.total_amount, 0);
      const calculationBase = Math.max(0, serviceAmount - current.valor_deducoes);
      return {
        ...current,
        itens: items,
        valor_servicos: serviceAmount,
        base_calculo: calculationBase,
        valor_iss: calculationBase * (current.aliquota_iss / 100),
      };
    });
  }

  function updateMoney(key: keyof FormState, value: number) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      const base = Math.max(0, Number(next.valor_servicos) - Number(next.valor_deducoes));
      return {
        ...next,
        base_calculo: key === "base_calculo" ? value : base,
        valor_iss: key === "valor_iss" ? value : base * (Number(next.aliquota_iss) / 100),
      } as FormState;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessUnit) {
      toast.error(
        "Selecione uma unidade de negócio específica no cabeçalho antes de criar a nota.",
      );
      return;
    }
    if (!form.cliente_id) {
      toast.error(
        form.operation_type === "entrada"
          ? "Selecione o fornecedor cadastrado."
          : "Selecione o cliente cadastrado.",
      );
      return;
    }
    if (
      !form.numero.trim() ||
      !form.tomador_razao_social.trim() ||
      !form.descricao_servicos.trim()
    ) {
      toast.error("Preencha número, razão social e descrição dos serviços.");
      return;
    }
    if (
      form.itens.length === 0 ||
      form.itens.some((item) => !item.description.trim() || item.quantity <= 0)
    ) {
      toast.error("Preencha corretamente todos os itens da nota.");
      return;
    }
    if (netAmount <= 0) {
      toast.error("O valor líquido da nota deve ser maior que zero.");
      return;
    }
    setSubmitting(true);
    let pdfObjectKey: string | null = null;
    try {
      if (pdf) pdfObjectKey = await uploadFiscalPdf(pdf);
      const payload: FiscalDocumentBundleInput = {
        business_unit_id: businessUnit.id,
        party_id: form.cliente_id,
        operation_type: form.operation_type,
        numero: form.numero.trim(),
        serie: form.serie.trim(),
        tipo_nota: form.tipo_nota,
        data_emissao: form.data_emissao,
        vencimento: form.vencimento,
        workflow_status: form.status,
        natureza_operacao: form.natureza_operacao.trim(),
        codigo_servico_municipal: form.codigo_servico_municipal,
        codigo_municipio: form.codigo_municipio.trim(),
        cfop: form.cfop.trim(),
        descricao_servicos: form.descricao_servicos.trim(),
        tomador_cnpj: form.tomador_cnpj.trim(),
        tomador_razao_social: form.tomador_razao_social.trim(),
        tomador_inscricao_estadual: form.tomador_inscricao_estadual.trim(),
        tomador_inscricao_municipal: form.tomador_inscricao_municipal.trim(),
        tomador_email: form.tomador_email.trim(),
        tomador_endereco: form.tomador_endereco.trim(),
        tomador_cidade: form.tomador_cidade.trim(),
        tomador_uf: form.tomador_uf,
        tomador_cep: form.tomador_cep.trim(),
        valor_servicos: form.valor_servicos,
        valor_deducoes: form.valor_deducoes,
        base_calculo: form.base_calculo,
        aliquota_iss: form.aliquota_iss,
        valor_iss: form.valor_iss,
        iss_retido: form.iss_retido,
        valor_pis: form.valor_pis,
        valor_cofins: form.valor_cofins,
        valor_inss: form.valor_inss,
        valor_ir: form.valor_ir,
        valor_csll: form.valor_csll,
        valor_liquido: netAmount,
        forma_pagamento: form.forma_pagamento,
        condicao_pagamento: form.condicao_pagamento.trim(),
        itens: form.itens,
        pdf_object_key: pdfObjectKey,
        observacoes: form.observacoes.trim(),
      };
      await createFiscalDocumentBundle(payload);
      await queryClient.invalidateQueries({ queryKey: ["financial-operations"] });
      toast.success(
        form.operation_type === "entrada" ? "Nota de entrada registrada." : "Nota fiscal criada.",
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar a nota fiscal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <form className="space-y-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {form.operation_type === "entrada"
                ? "Registrar Nota de Entrada"
                : "Emitir Nota Fiscal"}
            </DialogTitle>
            <DialogDescription>
              Formulário fiscal completo da unidade {businessUnit?.name ?? "não selecionada"}.
            </DialogDescription>
          </DialogHeader>

          <Section title="Tipo de Operação">
            <div className="grid gap-3 sm:grid-cols-2">
              <OperationButton
                active={form.operation_type === "saida"}
                icon={<ArrowUpRight className="h-5 w-5" />}
                title="Saída"
                description="Nota emitida para cliente / tomador"
                onClick={() => patch("operation_type", "saida")}
              />
              <OperationButton
                active={form.operation_type === "entrada"}
                icon={<ArrowDownLeft className="h-5 w-5" />}
                title="Entrada"
                description="Nota recebida de fornecedor / terceiro"
                onClick={() => patch("operation_type", "entrada")}
              />
            </div>
          </Section>

          <Section title="Identificação da Nota">
            <TwoColumns>
              <Field label="Número">
                <Input
                  value={form.numero}
                  onChange={(event) => patch("numero", event.target.value)}
                  placeholder="000001234"
                  required
                />
              </Field>
              <Field label="Série">
                <Input
                  value={form.serie}
                  onChange={(event) => patch("serie", event.target.value)}
                  placeholder="001"
                />
              </Field>
              <SelectField
                label="Tipo de Nota"
                value={form.tipo_nota}
                onChange={(value) => patch("tipo_nota", value as NoteType)}
                options={[
                  ["nfse", "NFS-e (Serviço)"],
                  ["nfe", "NF-e (Produto)"],
                  ["nfce", "NFC-e (Consumidor)"],
                ]}
              />
              <Field label="Data de Emissão">
                <Input
                  type="date"
                  value={form.data_emissao}
                  onChange={(event) => patch("data_emissao", event.target.value)}
                  required
                />
              </Field>
              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => patch("status", value as WorkflowStatus)}
                options={[
                  ["emitida", "Emitida"],
                  ["pendente", "Pendente"],
                  ["paga", "Paga"],
                  ["cancelada", "Cancelada"],
                ]}
              />
              <Field label="Natureza da Operação">
                <Input
                  value={form.natureza_operacao}
                  onChange={(event) => patch("natureza_operacao", event.target.value)}
                />
              </Field>
              <Field label="CFOP">
                <Input
                  value={form.cfop}
                  onChange={(event) => patch("cfop", event.target.value)}
                  placeholder="5933"
                />
              </Field>
              <SelectField
                label="Código Serviço Municipal"
                value={form.codigo_servico_municipal}
                onChange={(value) => patch("codigo_servico_municipal", value)}
                options={[...serviceCodes]}
              />
              <Field label="Código Município (IBGE)">
                <Input
                  value={form.codigo_municipio}
                  onChange={(event) => patch("codigo_municipio", event.target.value)}
                  placeholder="3550308"
                />
              </Field>
            </TwoColumns>
          </Section>

          <Section title={form.operation_type === "entrada" ? "Fornecedor / Emitente" : "Tomador"}>
            <div className="rounded-md border bg-muted/20 p-4 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                {form.operation_type === "entrada"
                  ? "Tomador (sua empresa, configurada em Empresa)"
                  : "Prestador (configurado em Empresa)"}
              </p>
              <p className="mt-1 font-medium">
                {legalEntity?.trade_name || legalEntity?.legal_name || "LANDER SOLUTIONS"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {legalEntity?.tax_id || "CNPJ não informado"}
              </p>
            </div>
            <TwoColumns>
              <SelectField
                label={
                  form.operation_type === "entrada"
                    ? "Fornecedor Cadastrado (preenche automaticamente)"
                    : "Cliente Cadastrado (preenche automaticamente)"
                }
                value={form.cliente_id}
                onChange={selectParty}
                options={[
                  ["", "Selecione um contato"],
                  ...parties.map((party): [string, string] => [
                    party.id,
                    party.trade_name?.trim() || party.legal_name,
                  ]),
                ]}
              />
              <Field
                label={
                  form.operation_type === "entrada"
                    ? "CNPJ / CPF do Emitente"
                    : "CNPJ / CPF do Tomador"
                }
              >
                <Input
                  value={form.tomador_cnpj}
                  onChange={(event) => patch("tomador_cnpj", event.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </Field>
              <Field
                label={
                  form.operation_type === "entrada"
                    ? "Razão Social / Nome do Emitente"
                    : "Razão Social / Nome do Tomador"
                }
              >
                <Input
                  value={form.tomador_razao_social}
                  onChange={(event) => patch("tomador_razao_social", event.target.value)}
                  required
                />
              </Field>
              <Field label="Inscrição Estadual">
                <Input
                  value={form.tomador_inscricao_estadual}
                  onChange={(event) => patch("tomador_inscricao_estadual", event.target.value)}
                />
              </Field>
              <Field label="Inscrição Municipal">
                <Input
                  value={form.tomador_inscricao_municipal}
                  onChange={(event) => patch("tomador_inscricao_municipal", event.target.value)}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.tomador_email}
                  onChange={(event) => patch("tomador_email", event.target.value)}
                />
              </Field>
              <Field label="Endereço">
                <Input
                  value={form.tomador_endereco}
                  onChange={(event) => patch("tomador_endereco", event.target.value)}
                  placeholder="Av. Paulista, 1000"
                />
              </Field>
              <Field label="Cidade">
                <Input
                  value={form.tomador_cidade}
                  onChange={(event) => patch("tomador_cidade", event.target.value)}
                />
              </Field>
              <SelectField
                label="UF"
                value={form.tomador_uf}
                onChange={(value) => patch("tomador_uf", value)}
                options={states.map((state): [string, string] => [state, state])}
              />
              <Field label="CEP">
                <Input
                  value={form.tomador_cep}
                  onChange={(event) => patch("tomador_cep", event.target.value)}
                  placeholder="00000-000"
                />
              </Field>
            </TwoColumns>
          </Section>

          <Section title="Serviços">
            <Field label="Descrição dos Serviços">
              <textarea
                value={form.descricao_servicos}
                onChange={(event) => patch("descricao_servicos", event.target.value)}
                rows={3}
                placeholder="Descrição completa dos serviços prestados..."
                className="w-full rounded-sm border bg-background px-3 py-2 text-sm"
                required
              />
            </Field>
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b p-4">
                <p className="font-medium">Itens da Nota</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch("itens", [
                      ...form.itens,
                      {
                        description: "",
                        service_code: form.codigo_servico_municipal,
                        quantity: 1,
                        unit_amount: 0,
                        total_amount: 0,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Adicionar Item
                </Button>
              </div>
              <div className="space-y-3 p-4">
                {form.itens.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-6"
                  >
                    <Field label="Descrição" className="lg:col-span-2">
                      <Input
                        value={item.description}
                        onChange={(event) => updateItem(index, "description", event.target.value)}
                      />
                    </Field>
                    <Field label="Cód. Serviço">
                      <Input
                        value={item.service_code}
                        onChange={(event) => updateItem(index, "service_code", event.target.value)}
                      />
                    </Field>
                    <Field label="Qtd">
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", Number(event.target.value))
                        }
                      />
                    </Field>
                    <Field label="Vlr Unit.">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_amount}
                        onChange={(event) =>
                          updateItem(index, "unit_amount", Number(event.target.value))
                        }
                      />
                    </Field>
                    <Field label="Total">
                      <div className="flex items-center gap-2">
                        <Input value={money(item.total_amount)} readOnly />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={form.itens.length === 1}
                          onClick={() =>
                            patch(
                              "itens",
                              form.itens.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Field>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Valores e Tributos">
            <TwoColumns>
              <MoneyField
                label="Valor dos Serviços"
                value={form.valor_servicos}
                onChange={(value) => updateMoney("valor_servicos", value)}
              />
              <MoneyField
                label="Deduções"
                value={form.valor_deducoes}
                onChange={(value) => updateMoney("valor_deducoes", value)}
              />
              <MoneyField
                label="Base de Cálculo"
                value={form.base_calculo}
                onChange={(value) => updateMoney("base_calculo", value)}
              />
              <MoneyField
                label="Alíquota ISS (%)"
                value={form.aliquota_iss}
                onChange={(value) => updateMoney("aliquota_iss", value)}
              />
              <MoneyField
                label="Valor ISS"
                value={form.valor_iss}
                onChange={(value) => updateMoney("valor_iss", value)}
              />
              <label className="flex items-center gap-3 rounded-sm border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.iss_retido}
                  onChange={(event) => patch("iss_retido", event.target.checked)}
                />
                <span>
                  <strong>ISS Retido na Fonte?</strong>
                  <span className="block text-xs text-muted-foreground">
                    {form.iss_retido
                      ? "Sim (retido pelo tomador)"
                      : "Não (recolhido pelo prestador)"}
                  </span>
                </span>
              </label>
              <MoneyField
                label="PIS"
                value={form.valor_pis}
                onChange={(value) => patch("valor_pis", value)}
              />
              <MoneyField
                label="COFINS"
                value={form.valor_cofins}
                onChange={(value) => patch("valor_cofins", value)}
              />
              <MoneyField
                label="IRRF"
                value={form.valor_ir}
                onChange={(value) => patch("valor_ir", value)}
              />
              <MoneyField
                label="CSLL"
                value={form.valor_csll}
                onChange={(value) => patch("valor_csll", value)}
              />
              <MoneyField
                label="INSS"
                value={form.valor_inss}
                onChange={(value) => patch("valor_inss", value)}
              />
            </TwoColumns>
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {form.operation_type === "entrada"
                    ? "Valor Líquido a Pagar"
                    : "Valor Líquido a Receber"}
                </p>
                <p className="mt-1 text-2xl font-bold text-primary">{money(netAmount)}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Bruto: {money(form.valor_servicos)}</p>
                <p>Total Retenções: {money(totalRetentions(form))}</p>
              </div>
            </div>
          </Section>

          <Section title="Pagamento">
            <TwoColumns>
              <SelectField
                label="Forma de Pagamento"
                value={form.forma_pagamento}
                onChange={(value) => patch("forma_pagamento", value)}
                options={[
                  ["dinheiro", "Dinheiro"],
                  ["pix", "PIX"],
                  ["transferencia", "Transferência"],
                  ["boleto", "Boleto"],
                  ["cartao_credito", "Cartão de Crédito"],
                  ["cartao_debito", "Cartão de Débito"],
                  ["cheque", "Cheque"],
                ]}
              />
              <Field label="Condição">
                <Input
                  value={form.condicao_pagamento}
                  onChange={(event) => patch("condicao_pagamento", event.target.value)}
                  placeholder="30 dias / À vista / 30/60/90"
                />
              </Field>
              <Field label="Vencimento">
                <Input
                  type="date"
                  value={form.vencimento}
                  onChange={(event) => patch("vencimento", event.target.value)}
                  required
                />
              </Field>
            </TwoColumns>
            <Field label="Arquivo PDF da Nota">
              {pdf ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm">{pdf.name}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setPdf(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
                  />
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Anexar PDF da NF (máx 10MB)</p>
                </label>
              )}
            </Field>
            <Field label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(event) => patch("observacoes", event.target.value)}
                rows={3}
                placeholder="Observações adicionais..."
                className="w-full rounded-sm border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </Section>

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {form.operation_type === "entrada" ? "Registrar Entrada" : "Emitir Nota"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="border-b pb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function TwoColumns({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
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
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}
function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}
function OperationButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
      >
        {icon}
      </span>
      <span>
        <strong className="text-sm">{title}</strong>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
function totalRetentions(form: FormState) {
  return (
    (form.iss_retido ? form.valor_iss : 0) +
    form.valor_pis +
    form.valor_cofins +
    form.valor_ir +
    form.valor_csll +
    form.valor_inss
  );
}
function calculateNet(form: FormState) {
  return Math.max(0, form.valor_servicos - form.valor_deducoes - totalRetentions(form));
}
function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}
