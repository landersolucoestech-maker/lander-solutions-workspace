import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

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
import {
  createCapitalStructure,
  createCorporateResolution,
  createOwnershipChange,
  createOwnershipChangeLine,
  createShareClass,
} from "./api";
import { createCorporateDocument } from "./api";
import type {
  CapitalStructure,
  CorporateResolution,
  GovernanceDocument,
  OwnershipChange,
  OwnershipChangeLine,
  OwnershipChangeType,
  OwnershipOperationType,
  PartyOption,
  ShareClass,
} from "./types";

const NONE_VALUE = "__none__";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro societário inesperado.";
}

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} é obrigatório.`);
  return normalized;
}

function requiredPositiveNumber(value: string, label: string) {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} deve ser maior que zero.`);
  }
  return number;
}

function numericValue(value: string) {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number)) throw new Error("Valor numérico inválido.");
  return number;
}

function FormActions({ submitting, onClose }: { submitting: boolean; onClose: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Salvar
      </Button>
    </DialogFooter>
  );
}

export function StructureCreateDialog({
  legalEntityId,
  currencyCode,
  nextVersion,
  onClose,
  onChanged,
}: {
  legalEntityId: string;
  currencyCode: string;
  nextVersion: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [capitalAmount, setCapitalAmount] = useState("");
  const [totalQuotas, setTotalQuotas] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createCapitalStructure({
        legal_entity_id: legalEntityId,
        version_no: nextVersion,
        currency_code: currencyCode,
        capital_amount: requiredPositiveNumber(capitalAmount, "Capital social"),
        total_quotas: requiredPositiveNumber(totalQuotas, "Total de quotas"),
        status: "draft",
        effective_from: effectiveFrom,
        change_reason: requiredText(reason, "Motivo da estrutura"),
      });
      await onChanged();
      toast.success("Estrutura de capital criada em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova estrutura de capital</DialogTitle>
          <DialogDescription>
            Cria a versão {nextVersion} em rascunho. A efetivação ocorrerá somente pelo workflow.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="capital-amount">Capital social</Label>
              <Input
                id="capital-amount"
                inputMode="decimal"
                value={capitalAmount}
                onChange={(event) => setCapitalAmount(event.target.value)}
                placeholder="10000,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-quotas">Total de quotas</Label>
              <Input
                id="total-quotas"
                inputMode="decimal"
                value={totalQuotas}
                onChange={(event) => setTotalQuotas(event.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="structure-currency">Moeda</Label>
              <Input id="structure-currency" value={currencyCode} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="structure-effective">Vigência pretendida</Label>
              <Input
                id="structure-effective"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="structure-reason">Motivo</Label>
            <Textarea
              id="structure-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Constituição, aumento, reorganização ou correção da estrutura."
            />
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShareClassCreateDialog({
  structure,
  onClose,
  onChanged,
}: {
  structure: CapitalStructure;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [authorizedQuotas, setAuthorizedQuotas] = useState("");
  const [votingRights, setVotingRights] = useState("true");
  const [votesPerQuota, setVotesPerQuota] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createShareClass({
        capital_structure_id: structure.id,
        code: requiredText(code, "Código").toUpperCase(),
        name: requiredText(name, "Nome"),
        description: description.trim() || null,
        authorized_quotas: requiredPositiveNumber(authorizedQuotas, "Quotas autorizadas"),
        voting_rights: votingRights === "true",
        votes_per_quota: requiredPositiveNumber(votesPerQuota, "Votos por quota"),
        distribution_priority: 0,
        liquidation_priority: 0,
        status: "active",
      });
      await onChanged();
      toast.success("Classe de quotas criada.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova classe de quotas</DialogTitle>
          <DialogDescription>
            A classe será vinculada à versão {structure.version_no}, ainda em rascunho.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="class-code">Código</Label>
              <Input
                id="class-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-name">Nome</Label>
              <Input
                id="class-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-quotas">Quotas autorizadas</Label>
              <Input
                id="class-quotas"
                inputMode="decimal"
                value={authorizedQuotas}
                onChange={(event) => setAuthorizedQuotas(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Direito a voto</Label>
              <Select value={votingRights} onValueChange={setVotingRights}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="votes-per-quota">Votos por quota</Label>
              <Input
                id="votes-per-quota"
                inputMode="decimal"
                value={votesPerQuota}
                onChange={(event) => setVotesPerQuota(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-description">Descrição</Label>
            <Textarea
              id="class-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CorporateDocumentCreateDialog({
  legalEntityId,
  userId,
  onClose,
  onChanged,
}: {
  legalEntityId: string;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState("corporate_resolution");
  const [label, setLabel] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [checksum, setChecksum] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!externalReference.trim() && !checksum.trim()) {
        throw new Error("Informe uma referência externa ou checksum SHA-256.");
      }
      if (checksum.trim() && !/^[a-f0-9]{64}$/i.test(checksum.trim())) {
        throw new Error("Checksum SHA-256 deve possuir 64 caracteres hexadecimais.");
      }
      await createCorporateDocument({
        legal_entity_id: legalEntityId,
        business_unit_id: null,
        asset_id: null,
        legal_matter_id: null,
        compliance_obligation_id: null,
        document_type: documentType,
        label: requiredText(label, "Título do documento"),
        storage_provider: "external",
        storage_bucket: null,
        storage_object_key: null,
        external_reference: externalReference.trim() || null,
        checksum_sha256: checksum.trim().toLowerCase() || null,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        status: "active",
        created_by: userId,
      });
      await onChanged();
      toast.success("Evidência societária cadastrada.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova evidência societária</DialogTitle>
          <DialogDescription>
            Registre contrato social, alteração, ata, decisão ou comprovante com referência
            verificável.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="articles_of_association">Contrato social</SelectItem>
                  <SelectItem value="corporate_amendment">Alteração contratual</SelectItem>
                  <SelectItem value="corporate_resolution">Ata ou decisão</SelectItem>
                  <SelectItem value="capital_contribution_evidence">
                    Comprovante de integralização
                  </SelectItem>
                  <SelectItem value="beneficial_ownership_evidence">Beneficiário final</SelectItem>
                  <SelectItem value="other_corporate_document">
                    Outro documento societário
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-label">Título</Label>
              <Input
                id="document-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-reference">Referência externa</Label>
            <Input
              id="document-reference"
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              placeholder="URL, protocolo, número de arquivamento ou referência controlada"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-checksum">Checksum SHA-256</Label>
            <Input
              id="document-checksum"
              value={checksum}
              onChange={(event) => setChecksum(event.target.value)}
              placeholder="64 caracteres hexadecimais"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-valid-from">Válido desde</Label>
              <Input
                id="document-valid-from"
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-valid-until">Válido até</Label>
              <Input
                id="document-valid-until"
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </div>
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResolutionCreateDialog({
  legalEntityId,
  documents,
  userId,
  onClose,
  onChanged,
}: {
  legalEntityId: string;
  documents: GovernanceDocument[];
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<CorporateResolution["resolution_type"]>("quotaholders_meeting");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [heldOn, setHeldOn] = useState(new Date().toISOString().slice(0, 10));
  const [documentId, setDocumentId] = useState(NONE_VALUE);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (documentId === NONE_VALUE) throw new Error("Evidência documental obrigatória.");
      await createCorporateResolution({
        legal_entity_id: legalEntityId,
        code: requiredText(code, "Código").toUpperCase(),
        resolution_type: type,
        title: requiredText(title, "Título"),
        summary: summary.trim() || null,
        held_on: heldOn,
        status: "draft",
        evidence_document_id: documentId,
        created_by: userId,
        updated_by: userId,
      });
      await onChanged();
      toast.success("Deliberação criada em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova deliberação</DialogTitle>
          <DialogDescription>
            A aprovação deve ser realizada por usuário diferente do autor.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resolution-code">Código</Label>
              <Input
                id="resolution-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shareholders_meeting">Assembleia de acionistas</SelectItem>
                  <SelectItem value="quotaholders_meeting">Reunião de sócios</SelectItem>
                  <SelectItem value="sole_shareholder_decision">Decisão de sócio único</SelectItem>
                  <SelectItem value="board_resolution">Deliberação do conselho</SelectItem>
                  <SelectItem value="management_decision">Decisão da administração</SelectItem>
                  <SelectItem value="written_consent">Consentimento escrito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resolution-title">Título</Label>
            <Input
              id="resolution-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resolution-summary">Resumo</Label>
            <Textarea
              id="resolution-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resolution-date">Data da deliberação</Label>
              <Input
                id="resolution-date"
                type="date"
                value={heldOn}
                onChange={(event) => setHeldOn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Evidência</Label>
              <Select value={documentId} onValueChange={setDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Selecione</SelectItem>
                  {documents.map((document) => (
                    <SelectItem key={document.id} value={document.id}>
                      {document.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OwnershipChangeCreateDialog({
  legalEntityId,
  structures,
  resolutions,
  documents,
  userId,
  onClose,
  onChanged,
}: {
  legalEntityId: string;
  structures: CapitalStructure[];
  resolutions: CorporateResolution[];
  documents: GovernanceDocument[];
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [changeType, setChangeType] = useState<OwnershipChangeType>("quota_transfer");
  const [effectiveOn, setEffectiveOn] = useState(new Date().toISOString().slice(0, 10));
  const [sourceStructureId, setSourceStructureId] = useState(NONE_VALUE);
  const [resolutionId, setResolutionId] = useState(NONE_VALUE);
  const [documentId, setDocumentId] = useState(NONE_VALUE);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (documentId === NONE_VALUE) throw new Error("Evidência documental obrigatória.");
      await createOwnershipChange({
        legal_entity_id: legalEntityId,
        code: requiredText(code, "Código").toUpperCase(),
        change_type: changeType,
        effective_on: effectiveOn,
        status: "draft",
        source_capital_structure_id: sourceStructureId === NONE_VALUE ? null : sourceStructureId,
        resulting_capital_structure_id: null,
        resolution_id: resolutionId === NONE_VALUE ? null : resolutionId,
        evidence_document_id: documentId,
        justification: requiredText(justification, "Justificativa"),
        requested_by: userId,
        created_by: userId,
        updated_by: userId,
      });
      await onChanged();
      toast.success("Alteração societária criada em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova alteração societária</DialogTitle>
          <DialogDescription>
            Após incluir as linhas, submeta para aprovação independente e aplicação atômica.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="change-code">Código</Label>
              <Input
                id="change-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={changeType}
                onValueChange={(value) => setChangeType(value as OwnershipChangeType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incorporation">Constituição</SelectItem>
                  <SelectItem value="quota_issue">Emissão de quotas</SelectItem>
                  <SelectItem value="quota_transfer">Transferência de quotas</SelectItem>
                  <SelectItem value="capital_increase">Aumento de capital</SelectItem>
                  <SelectItem value="capital_reduction">Redução de capital</SelectItem>
                  <SelectItem value="capital_contribution">Integralização</SelectItem>
                  <SelectItem value="share_class_change">Alteração de classe</SelectItem>
                  <SelectItem value="beneficial_owner_change">Beneficiário final</SelectItem>
                  <SelectItem value="administration_change">Administração</SelectItem>
                  <SelectItem value="correction">Correção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="change-effective">Data de vigência</Label>
              <Input
                id="change-effective"
                type="date"
                value={effectiveOn}
                onChange={(event) => setEffectiveOn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estrutura de origem</Label>
              <Select value={sourceStructureId} onValueChange={setSourceStructureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem estrutura</SelectItem>
                  {structures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      Versão {structure.version_no} · {structure.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Deliberação</Label>
              <Select value={resolutionId} onValueChange={setResolutionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem deliberação</SelectItem>
                  {resolutions.map((resolution) => (
                    <SelectItem key={resolution.id} value={resolution.id}>
                      {resolution.code} · {resolution.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Evidência</Label>
              <Select value={documentId} onValueChange={setDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Selecione</SelectItem>
                  {documents.map((document) => (
                    <SelectItem key={document.id} value={document.id}>
                      {document.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="change-justification">Justificativa</Label>
            <Textarea
              id="change-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OwnershipChangeLineCreateDialog({
  change,
  nextSequence,
  parties,
  shareClasses,
  positions,
  userId,
  onClose,
  onChanged,
}: {
  change: OwnershipChange;
  nextSequence: number;
  parties: PartyOption[];
  shareClasses: ShareClass[];
  positions: Array<{
    id: string;
    holder_party_id: string;
    share_class_id: string;
    quota_quantity: number;
  }>;
  userId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [operationType, setOperationType] = useState<OwnershipOperationType>("issue");
  const [holderPartyId, setHolderPartyId] = useState(NONE_VALUE);
  const [counterpartyPartyId, setCounterpartyPartyId] = useState(NONE_VALUE);
  const [shareClassId, setShareClassId] = useState(NONE_VALUE);
  const [sourcePositionId, setSourcePositionId] = useState(NONE_VALUE);
  const [quotaDelta, setQuotaDelta] = useState("0");
  const [capitalDelta, setCapitalDelta] = useState("0");
  const [roleType, setRoleType] = useState("shareholder");
  const [contributionType, setContributionType] = useState("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const details: Record<string, unknown> = {};
      if (operationType === "role_add" || operationType === "role_end") {
        details.role_type = roleType;
      }
      if (operationType === "contribute") details.contribution_type = contributionType;
      if (notes.trim()) details.notes = notes.trim();
      if (operationType === "issue") details.acquisition_method = "subscription";

      await createOwnershipChangeLine({
        change_id: change.id,
        sequence_no: nextSequence,
        operation_type: operationType,
        holder_party_id: holderPartyId === NONE_VALUE ? null : holderPartyId,
        counterparty_party_id: counterpartyPartyId === NONE_VALUE ? null : counterpartyPartyId,
        share_class_id: shareClassId === NONE_VALUE ? null : shareClassId,
        source_position_id: sourcePositionId === NONE_VALUE ? null : sourcePositionId,
        quota_delta: numericValue(quotaDelta),
        capital_delta: numericValue(capitalDelta),
        details,
        created_by: userId,
      });
      await onChanged();
      toast.success("Linha societária incluída.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova linha da alteração</DialogTitle>
          <DialogDescription>
            Linha {nextSequence} de {change.code}. Quantidades negativas representam saída ou
            redução.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Operação</Label>
            <Select
              value={operationType}
              onValueChange={(value) => setOperationType(value as OwnershipOperationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issue">Emissão</SelectItem>
                <SelectItem value="transfer_out">Saída por transferência</SelectItem>
                <SelectItem value="transfer_in">Entrada por transferência</SelectItem>
                <SelectItem value="cancel">Cancelamento de quotas</SelectItem>
                <SelectItem value="increase">Aumento de capital/quotas</SelectItem>
                <SelectItem value="reduce">Redução de capital/quotas</SelectItem>
                <SelectItem value="contribute">Integralização</SelectItem>
                <SelectItem value="role_add">Adicionar vínculo</SelectItem>
                <SelectItem value="role_end">Encerrar vínculo</SelectItem>
                <SelectItem value="adjust">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Titular</Label>
              <Select value={holderPartyId} onValueChange={setHolderPartyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Não informado</SelectItem>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.trade_name || party.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contraparte</Label>
              <Select value={counterpartyPartyId} onValueChange={setCounterpartyPartyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Não informada</SelectItem>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.trade_name || party.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Classe de quotas</Label>
              <Select value={shareClassId} onValueChange={setShareClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Não informada</SelectItem>
                  {shareClasses.map((shareClass) => (
                    <SelectItem key={shareClass.id} value={shareClass.id}>
                      {shareClass.code} · {shareClass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Posição de origem</Label>
              <Select value={sourcePositionId} onValueChange={setSourcePositionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Não informada</SelectItem>
                  {positions.map((position) => {
                    const party = parties.find((item) => item.id === position.holder_party_id);
                    return (
                      <SelectItem key={position.id} value={position.id}>
                        {party?.trade_name || party?.legal_name || position.id} ·{" "}
                        {position.quota_quantity}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="line-quota-delta">Variação de quotas</Label>
              <Input
                id="line-quota-delta"
                inputMode="decimal"
                value={quotaDelta}
                onChange={(event) => setQuotaDelta(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-capital-delta">Variação de capital</Label>
              <Input
                id="line-capital-delta"
                inputMode="decimal"
                value={capitalDelta}
                onChange={(event) => setCapitalDelta(event.target.value)}
              />
            </div>
          </div>
          {(operationType === "role_add" || operationType === "role_end") && (
            <div className="space-y-2">
              <Label>Tipo de vínculo</Label>
              <Select value={roleType} onValueChange={setRoleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shareholder">Sócio</SelectItem>
                  <SelectItem value="administrator">Administrador</SelectItem>
                  <SelectItem value="director">Diretor</SelectItem>
                  <SelectItem value="officer">Executivo</SelectItem>
                  <SelectItem value="beneficial_owner">Beneficiário final</SelectItem>
                  <SelectItem value="legal_representative">Representante legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {operationType === "contribute" && (
            <div className="space-y-2">
              <Label>Forma de integralização</Label>
              <Select value={contributionType} onValueChange={setContributionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="asset">Bem</SelectItem>
                  <SelectItem value="service">Serviço permitido</SelectItem>
                  <SelectItem value="conversion">Conversão</SelectItem>
                  <SelectItem value="other">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="line-notes">Observações</Label>
            <Textarea
              id="line-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <FormActions submitting={submitting} onClose={onClose} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReasonDialog({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(requiredText(reason, "Motivo"));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="workflow-reason">Motivo</Label>
            <Textarea
              id="workflow-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
