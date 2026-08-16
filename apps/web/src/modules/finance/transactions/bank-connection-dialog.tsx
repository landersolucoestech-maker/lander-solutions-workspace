import { useState } from "react";
import { ExternalLink, Landmark, ShieldCheck } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
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
import {
  BANK_CONNECTION_PROVIDERS,
  type BankConnectionProvider,
} from "./bank-connection-providers";

export function BankConnectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedProviderId, setSelectedProviderId] = useState(
    BANK_CONNECTION_PROVIDERS[0]?.id ?? "",
  );
  const selectedProvider =
    BANK_CONNECTION_PROVIDERS.find((provider) => provider.id === selectedProviderId) ?? null;

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conectar conta bancária</DialogTitle>
          <DialogDescription>
            Escolha um canal de conexão. A autenticação acontecerá sempre no ambiente seguro do
            banco ou do provider, nunca dentro da LANDER.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3" aria-label="Provedores de conexão bancária">
          {BANK_CONNECTION_PROVIDERS.map((provider) => (
            <ProviderOption
              key={provider.id}
              provider={provider}
              selected={provider.id === selectedProviderId}
              onSelect={() => setSelectedProviderId(provider.id)}
            />
          ))}
        </div>

        {selectedProvider ? (
          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Fluxo seguro previsto</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Seleção do provider → redirecionamento OAuth/Open Finance → autorização externa →
                  callback seguro → sincronização pelo owner financeiro existente.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  A LANDER não solicita nem armazena senha de internet banking, token bancário ou
                  credenciais da instituição.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
          <Button type="button" disabled>
            <ExternalLink className="h-4 w-4" /> Integração ainda não configurada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderOption({
  provider,
  selected,
  onSelect,
}: {
  provider: BankConnectionProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-colors hover:border-primary/50 ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-background p-2 text-primary">
          <Landmark className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{provider.name}</span>
            <Badge variant="outline">Configuração necessária</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {provider.capabilities.map((capability) => (
              <Badge key={capability} variant="secondary">
                {capability}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Autenticação: redirecionamento OAuth externo
          </p>
        </div>
      </div>
    </button>
  );
}
