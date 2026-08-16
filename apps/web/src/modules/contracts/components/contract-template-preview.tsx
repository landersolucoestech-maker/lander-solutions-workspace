import { FileText } from "lucide-react";

import type { ContractTemplateImageAlignment } from "@/modules/contracts/types";
import { cn } from "@/shared/utils/cn";

type ContractTemplatePreviewProps = {
  title?: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  headerImageAlignment?: ContractTemplateImageAlignment;
  footerImageAlignment?: ContractTemplateImageAlignment;
  showHeading?: boolean;
  showEmptyRegions?: boolean;
  className?: string;
};

const ALIGNMENT_CLASS: Record<ContractTemplateImageAlignment, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

function PreviewText({ text, empty }: { text: string; empty: string }) {
  if (!text.trim()) return <span className="text-muted-foreground/60 italic">{empty}</span>;

  return text.split(/(\{\{[^{}]+\}\})/g).map((part, index) =>
    /^\{\{[^{}]+\}\}$/.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-sm bg-primary/10 px-0.5 font-mono text-[0.92em] text-primary"
      >
        {part}
      </mark>
    ) : (
      <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>
    ),
  );
}

function BrandingImage({
  url,
  alt,
  alignment,
}: {
  url: string | null | undefined;
  alt: string;
  alignment: ContractTemplateImageAlignment;
}) {
  if (!url) return null;
  return (
    <div className={cn("flex w-full", ALIGNMENT_CLASS[alignment])}>
      <img src={url} alt={alt} className="max-h-28 max-w-full object-contain" />
    </div>
  );
}

export function ContractTemplatePreview({
  title,
  headerText,
  bodyText,
  footerText,
  headerImageUrl,
  footerImageUrl,
  headerImageAlignment = "center",
  footerImageAlignment = "center",
  showHeading = true,
  showEmptyRegions = true,
  className,
}: ContractTemplatePreviewProps) {
  const empty =
    !headerImageUrl &&
    !footerImageUrl &&
    !headerText.trim() &&
    !bodyText.trim() &&
    !footerText.trim();

  return (
    <section className={cn("min-w-0", className)} aria-label="Preview A4 do template">
      {showHeading ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Preview do documento</p>
            <p className="text-xs text-muted-foreground">Página A4 · proporção 210 × 297 mm</p>
          </div>
          {title ? (
            <p className="max-w-48 truncate text-xs text-muted-foreground">{title}</p>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[794px] overflow-hidden rounded-sm border bg-white text-slate-900 shadow-lg">
        <article
          className="flex aspect-[210/297] min-h-[680px] w-full flex-col px-[8%] py-[6%]"
          data-testid="contract-template-a4-preview"
        >
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-400">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">O documento aparecerá aqui enquanto você edita.</p>
            </div>
          ) : (
            <>
              {showEmptyRegions || headerImageUrl || headerText.trim() ? (
                <header className="space-y-3 border-b border-slate-200 pb-4 text-center text-[clamp(8px,1.4vw,12px)]">
                  <BrandingImage
                    url={headerImageUrl}
                    alt="Imagem de cabeçalho do template"
                    alignment={headerImageAlignment}
                  />
                  {showEmptyRegions || headerText.trim() ? (
                    <p className="whitespace-pre-wrap">
                      <PreviewText text={headerText} empty="Sem texto de cabeçalho" />
                    </p>
                  ) : null}
                </header>
              ) : null}

              <main className="flex-1 whitespace-pre-wrap py-6 text-left font-serif text-[clamp(9px,1.55vw,13px)] leading-relaxed">
                <PreviewText text={bodyText} empty="Sem conteúdo do documento" />
              </main>

              {showEmptyRegions || footerImageUrl || footerText.trim() ? (
                <footer className="space-y-3 border-t border-slate-200 pt-4 text-center text-[clamp(8px,1.3vw,11px)] text-slate-600">
                  {showEmptyRegions || footerText.trim() ? (
                    <p className="whitespace-pre-wrap">
                      <PreviewText text={footerText} empty="Sem texto de rodapé" />
                    </p>
                  ) : null}
                  <BrandingImage
                    url={footerImageUrl}
                    alt="Imagem de rodapé do template"
                    alignment={footerImageAlignment}
                  />
                </footer>
              ) : null}
            </>
          )}
        </article>
      </div>
    </section>
  );
}
