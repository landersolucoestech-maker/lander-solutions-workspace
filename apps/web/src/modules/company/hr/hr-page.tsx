import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Kpi, Panel } from "@/shared/components/ui-kit";
import { listHrDirectory } from "./api";
import { HrActionDialog, type HrActionState } from "./hr-action-dialogs";
import { HrDocumentManagementActions } from "./hr-document-management-actions";
import { HrOperationalManagementActions } from "./hr-operational-management-actions";
import { HrRecordDialog, type HrRecordActionState } from "./hr-record-dialog";
import { DocumentsSection, EmployeesSection, LeaveSection, PaymentsSection } from "./hr-sections";

export function HrPage() {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<HrActionState>(null);
  const [recordAction, setRecordAction] = useState<HrRecordActionState>(null);
  const query = useQuery({
    queryKey: ["hr-directory"],
    queryFn: listHrDirectory,
  });

  useEffect(() => {
    const createEmployee = () => setAction({ kind: "create-employee" });
    window.addEventListener("hr:new-employee", createEmployee);
    return () => window.removeEventListener("hr:new-employee", createEmployee);
  }, []);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["hr-directory"] });
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" /> Carregando Recursos Humanos…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Panel title="Falha de consulta ou autorização">
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const data = query.data;
  const summary = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Colaboradores ativos" value={String(summary.activeEmployees)} />
        <Kpi
          label="Afastados"
          value={String(summary.awayEmployees)}
          tone={summary.awayEmployees > 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="Contratos a vencer"
          value={String(summary.expiringContracts)}
          tone={summary.expiringContracts > 0 ? "warning" : "neutral"}
          hint="Próximos 30 dias"
        />
        <Kpi
          label="Documentos a vencer"
          value={String(summary.expiringDocuments)}
          tone={summary.expiringDocuments > 0 ? "warning" : "neutral"}
          hint="Próximos 30 dias"
        />
        <Kpi label="Ausências próximas" value={String(summary.upcomingLeaves)} />
        <Kpi label="Onboardings pendentes" value={String(summary.pendingOnboardings)} />
        <Kpi
          label="Desligamentos em andamento"
          value={String(summary.activeOffboardings)}
          tone={summary.activeOffboardings > 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="Pagamentos pendentes"
          value={String(summary.pendingPayments)}
          tone={summary.pendingPayments > 0 ? "warning" : "neutral"}
        />
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max rounded-sm">
            <TabsTrigger value="employees">Colaboradores/Funcionários</TabsTrigger>
            <TabsTrigger value="payments">Folha de pagamento</TabsTrigger>
            <TabsTrigger value="leave">Férias e ausências</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="employees" className="space-y-4">
          <EmployeesSection data={data} onAction={setAction} onRecordAction={setRecordAction} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsSection
            data={data}
            onAction={setAction}
            onRecordAction={setRecordAction}
            extraActions={
              data.permissions.managePayments ? (
                <HrOperationalManagementActions data={data} onSuccess={refresh} showLeave={false} />
              ) : null
            }
          />
        </TabsContent>

        <TabsContent value="leave">
          <LeaveSection
            data={data}
            onAction={setAction}
            onRecordAction={setRecordAction}
            extraActions={
              data.permissions.manageLeave ? (
                <HrOperationalManagementActions
                  data={data}
                  onSuccess={refresh}
                  showPayment={false}
                />
              ) : null
            }
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsSection
            data={data}
            onAction={setAction}
            onRecordAction={setRecordAction}
            extraActions={
              data.permissions.manageDocuments ? (
                <HrDocumentManagementActions data={data} onSuccess={refresh} />
              ) : null
            }
          />
        </TabsContent>
      </Tabs>

      <HrActionDialog
        action={action}
        data={data}
        onOpenChange={(open) => !open && setAction(null)}
        onSuccess={refresh}
      />
      <HrRecordDialog
        state={recordAction}
        data={data}
        onClose={() => setRecordAction(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada.";
}
