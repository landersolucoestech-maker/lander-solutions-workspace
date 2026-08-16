import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Panel, StatusPill } from "@/shared/components/ui-kit";
import { getOrCreateSupportDraft, invokeSupportAction } from "../api";
import { supportErrorMessage as errorMessage } from "../errors";
import type { SupportWorkspace } from "../types";
import { DraftEditor } from "./draft-editor";

export function SupportAutomationEditor({ workspace }: { workspace: SupportWorkspace }) {
  const queryClient = useQueryClient();
  const draft = workspace.automationVersions.find((version) => version.status === "draft");
  const [restorePendingId, setRestorePendingId] = useState<string | null>(null);
  const createDraft = useMutation({
    mutationFn: () => getOrCreateSupportDraft(workspace.product.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success("Rascunho disponível.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const restore = useMutation({
    mutationFn: (sourceVersionId: string) =>
      invokeSupportAction({ action: "restore-automation-version", sourceVersionId }),
    onMutate: setRestorePendingId,
    onSettled: () => setRestorePendingId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success("Versão restaurada como novo rascunho.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {draft ? (
        <DraftEditor key={`${draft.id}-${draft.version}`} workspace={workspace} draft={draft} />
      ) : (
        <Panel
          title="Automações de Atendimento"
          description="Nenhum rascunho está aberto para este produto."
          actions={
            <Button size="sm" disabled={createDraft.isPending} onClick={() => createDraft.mutate()}>
              {createDraft.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Criar rascunho
            </Button>
          }
        >
          <p className="p-6 text-sm text-muted-foreground">
            Uma versão publicada permanece imutável. Novas alterações são feitas em rascunho.
          </p>
        </Panel>
      )}
      <Panel title="Histórico de versões" description="Versões publicadas e arquivadas do produto.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Publicação</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.automationVersions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhuma versão criada.
                  </TableCell>
                </TableRow>
              ) : (
                workspace.automationVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">v{version.version_number}</TableCell>
                    <TableCell>
                      <StatusPill status={version.status} />
                    </TableCell>
                    <TableCell>
                      {version.published_at
                        ? new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(version.published_at))
                        : "—"}
                    </TableCell>
                    <TableCell>{version.validation_errors.length}</TableCell>
                    <TableCell className="text-right">
                      {version.status !== "draft" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(draft) || restore.isPending}
                          onClick={() => restore.mutate(version.id)}
                        >
                          {restorePendingId === version.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          Restaurar como rascunho
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
