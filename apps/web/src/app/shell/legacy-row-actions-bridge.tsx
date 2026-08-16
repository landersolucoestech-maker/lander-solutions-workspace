import { useEffect } from "react";

const ACTION_LABELS = [
  { key: "view", pattern: /^ver$/i, label: "Ver" },
  { key: "edit", pattern: /^editar$/i, label: "Editar" },
  { key: "delete", pattern: /^(excluir|remover)$/i, label: "Excluir" },
] as const;

interface BridgeEntry {
  original: HTMLButtonElement;
  proxy: HTMLButtonElement;
}

/**
 * Camada transitória para módulos anteriores à padronização do RowActionsMenu.
 * Preserva os handlers React dos botões originais e altera apenas a apresentação.
 */
export function LegacyRowActionsBridge() {
  useEffect(() => {
    const registry = new Map<
      HTMLElement,
      { details: HTMLDetailsElement; entries: BridgeEntry[] }
    >();

    function buttonLabel(button: HTMLButtonElement) {
      return (button.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function actionFor(button: HTMLButtonElement) {
      const label = buttonLabel(button);
      return ACTION_LABELS.find((action) => action.pattern.test(label)) ?? null;
    }

    function isIgnored(button: HTMLButtonElement) {
      return Boolean(
        button.closest("[data-standard-row-actions]") ||
        button.closest("[data-legacy-row-actions]") ||
        button.dataset.legacyActionOriginal,
      );
    }

    function syncContainer(container: HTMLElement) {
      const existing = registry.get(container);
      if (existing) {
        if (!container.isConnected) {
          registry.delete(container);
          return;
        }
        for (const entry of existing.entries) {
          entry.proxy.disabled = entry.original.disabled;
          entry.proxy.setAttribute("aria-disabled", String(entry.original.disabled));
        }
        return;
      }

      const candidates = Array.from(container.children)
        .filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
        .map((button) => ({ button, action: actionFor(button) }))
        .filter(
          (entry): entry is { button: HTMLButtonElement; action: (typeof ACTION_LABELS)[number] } =>
            Boolean(entry.action) && !isIgnored(entry.button),
        );

      if (candidates.length < 2) return;
      const uniqueActions = new Set(candidates.map((entry) => entry.action.key));
      if (uniqueActions.size < 2) return;

      const details = document.createElement("details");
      details.dataset.legacyRowActions = "true";
      details.className = "relative ml-auto inline-block text-left";

      const summary = document.createElement("summary");
      summary.className =
        "flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden";
      summary.setAttribute("aria-label", "Abrir ações do registro");
      summary.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';

      const menu = document.createElement("div");
      menu.className =
        "absolute right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md";
      menu.setAttribute("role", "menu");

      const entries: BridgeEntry[] = [];
      for (const { button, action } of candidates) {
        button.dataset.legacyActionOriginal = "true";
        button.style.display = "none";

        if (action.key === "delete" && menu.childElementCount > 0) {
          const separator = document.createElement("div");
          separator.className = "-mx-1 my-1 h-px bg-muted";
          separator.setAttribute("role", "separator");
          menu.append(separator);
        }

        const proxy = document.createElement("button");
        proxy.type = "button";
        proxy.disabled = button.disabled;
        proxy.setAttribute("aria-disabled", String(button.disabled));
        proxy.setAttribute("role", "menuitem");
        proxy.className =
          action.key === "delete"
            ? "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            : "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50";
        proxy.textContent = action.label;
        proxy.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          details.open = false;
          if (!button.disabled) button.click();
        });
        menu.append(proxy);
        entries.push({ original: button, proxy });
      }

      details.append(summary, menu);
      container.append(details);
      registry.set(container, { details, entries });
    }

    function scan() {
      const containers = new Set<HTMLElement>();
      document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        if (!actionFor(button) || isIgnored(button)) return;
        if (button.parentElement) containers.add(button.parentElement);
      });
      containers.forEach(syncContainer);
      for (const container of registry.keys()) {
        if (!container.isConnected) registry.delete(container);
      }
    }

    function closeOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      for (const { details } of registry.values()) {
        if (details.open && target && !details.contains(target)) details.open = false;
      }
    }

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    document.addEventListener("click", closeOutside);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", closeOutside);
      for (const { details, entries } of registry.values()) {
        details.remove();
        for (const entry of entries) {
          delete entry.original.dataset.legacyActionOriginal;
          entry.original.style.removeProperty("display");
        }
      }
      registry.clear();
    };
  }, []);

  return null;
}
