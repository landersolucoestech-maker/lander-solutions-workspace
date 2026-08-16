import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Headphones, Layers3, LibraryBig, Settings2, ShieldAlert } from "lucide-react";

import { useAuth } from "@/app/providers/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { getSupportWorkspace, listSupportInbox, listSupportProducts, SupportApiError } from "./api";
import { SupportCoreAdministration } from "./administration/core-administration";
import { SupportContentAdministration } from "./administration/content-administration";
import { SupportAutomationEditor } from "./automation/automation-editor";
import { SupportOperationalWorkspace } from "./operation/support-workspace";
import { SupportOverview } from "./support-panels";

function errorMessage(error: unknown) {
  if (error instanceof SupportApiError) {
    return error.requestId ? `${error.message} (requisição ${error.requestId})` : error.message;
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-sm" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-sm" />
    </div>
  );
}

export function SupportPage() {
  const { session, user } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState("");
  const products = useQuery({
    queryKey: ["support-products"],
    queryFn: listSupportProducts,
    enabled: Boolean(session && user),
  });

  const activeProductId = products.data?.some((item) => item.id === selectedProductId)
    ? selectedProductId
    : (products.data?.[0]?.id ?? "");

  const workspace = useQuery({
    queryKey: ["support-workspace", activeProductId],
    queryFn: () => getSupportWorkspace(activeProductId),
    enabled: Boolean(session && activeProductId),
  });
  const inbox = useQuery({
    queryKey: ["support-inbox", activeProductId],
    queryFn: () => listSupportInbox({ productId: activeProductId, pageSize: 100 }),
    enabled: Boolean(session && activeProductId),
  });

  if (!session || !user) {
    return (
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Autenticação obrigatória</AlertTitle>
        <AlertDescription>
          Conversas, tickets e configurações não aceitam acesso anônimo. Este ambiente mantém a
          autenticação desativada; use o módulo em um ambiente autenticado com papel de suporte.
        </AlertDescription>
      </Alert>
    );
  }
  if (products.isLoading) return <LoadingState />;
  if (products.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar produtos</AlertTitle>
        <AlertDescription>{errorMessage(products.error)}</AlertDescription>
      </Alert>
    );
  }
  if (!products.data?.length) {
    return (
      <Alert>
        <AlertTitle>Nenhum produto autorizado</AlertTitle>
        <AlertDescription>
          O backend não retornou produtos disponíveis para este usuário.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Atendimento corporativo da Lander Solutions</AlertTitle>
        <AlertDescription>
          Esta área organiza o atendimento administrado pela Lander Solutions. O vínculo com um
          produto identifica contexto, marca e regras de atendimento; ele não substitui o sistema
          operacional interno do produto.
        </AlertDescription>
      </Alert>
      <div className="rounded-sm border bg-card p-4">
        <div className="w-full max-w-md">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contexto de atendimento
          </p>
          <Select
            value={activeProductId}
            onValueChange={(value) => {
              setSelectedProductId(value);
            }}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {products.data.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.settings.brand_name || item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {workspace.isLoading || inbox.isLoading ? <LoadingState /> : null}
      {workspace.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar atendimento</AlertTitle>
          <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
        </Alert>
      ) : null}
      {inbox.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar caixa de entrada</AlertTitle>
          <AlertDescription>{errorMessage(inbox.error)}</AlertDescription>
        </Alert>
      ) : null}
      {workspace.data && inbox.data ? (
        <>
          <Tabs defaultValue="operation" className="space-y-4">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
              <TabsTrigger value="operation">
                <Headphones />
                Atendimentos
              </TabsTrigger>
              <TabsTrigger value="administration">
                <Settings2 />
                Administração do atendimento
              </TabsTrigger>
            </TabsList>
            <TabsContent value="operation">
              <SupportOperationalWorkspace
                key={activeProductId}
                workspace={workspace.data}
                conversations={inbox.data.conversations}
              />
            </TabsContent>
            <TabsContent value="administration">
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-sm">
                  <TabsTrigger value="overview">
                    <Layers3 /> Visão geral
                  </TabsTrigger>
                  <TabsTrigger value="operation">
                    <Settings2 /> Filas, agentes e canais
                  </TabsTrigger>
                  <TabsTrigger value="content">
                    <LibraryBig /> Conteúdo, horários e SLA
                  </TabsTrigger>
                  <TabsTrigger value="automation">
                    <Bot /> Automações
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <SupportOverview workspace={workspace.data} inboxCount={inbox.data.count} />
                </TabsContent>
                <TabsContent value="operation">
                  <SupportCoreAdministration workspace={workspace.data} />
                </TabsContent>
                <TabsContent value="content">
                  <SupportContentAdministration workspace={workspace.data} />
                </TabsContent>
                <TabsContent value="automation">
                  <SupportAutomationEditor workspace={workspace.data} />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
