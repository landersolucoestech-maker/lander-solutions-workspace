import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteEmployeeDocument } from "./hr-admin-mutations";
import { Field, Hint, employeeName, selectClass } from "./hr-management-fields";
import type { HrDirectory } from "./types";

interface Props {
  data: HrDirectory;
  onSuccess: () => Promise<void>;
}

export function HrDocumentManagementActions({ data, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedDocument = data.documents.find((document) => document.id === documentId);

  function closeDialog() {
    setOpen(false);
    setDocumentId("");
  }

  async function removeDocument() {
    if (!selectedDocument) return;
    setSubmitting(true);

    try {
      await deleteEmployeeDocument({
        documentId: selectedDocument.id,
        expectedVersion: selectedDocument.version,
      });
      await onSuccess();
      toast.success("Documento retirado do cadastro.");
      closeDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao retirar documento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={data.documents.length === 0}
      >
        <Trash2 /> Retirar documento
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Retirar documento</DialogTitle>
            <DialogDescription>
              O arquivo deixa de aparecer no cadastro, mas o registro e a auditoria são preservados.
            </DialogDescription>
          </DialogHeader>
          <Field label="Documento">
            <select
              className={selectClass}
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">Selecione</option>
              {data.documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.name} · {employeeName(data, document.employee_id)}
                </option>
              ))}
            </select>
          </Field>
          {selectedDocument ? (
            <Hint>
              Será retirado “{selectedDocument.name}”, arquivo original “
              {selectedDocument.original_file_name}”. Esta ação não exclui fisicamente o histórico.
            </Hint>
          ) : (
            <Hint>Selecione o documento que será retirado.</Hint>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void removeDocument()}
              disabled={!selectedDocument || submitting}
            >
              {submitting ? "Retirando…" : "Retirar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
