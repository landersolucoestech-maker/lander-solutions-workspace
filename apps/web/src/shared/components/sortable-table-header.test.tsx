import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SortableTableHeader, type SortableTableHeaderProps } from "./sortable-table-header";

function renderHeader(props: Partial<SortableTableHeaderProps> = {}) {
  return renderToStaticMarkup(
    <table>
      <thead>
        <tr>
          <SortableTableHeader
            label="Data"
            active={false}
            direction="desc"
            onSort={() => undefined}
            {...props}
          />
        </tr>
      </thead>
    </table>,
  );
}

describe("SortableTableHeader", () => {
  it("renders the neutral state with its next action", () => {
    const markup = renderHeader();

    expect(markup).not.toContain("aria-sort");
    expect(markup).toContain('aria-label="Ordenar Data em ordem crescente"');
    expect(markup).toContain("lucide lucide-arrow-up-down h-3.5 w-3.5");
  });

  it("renders the ascending state and describes the descending action", () => {
    const markup = renderHeader({ active: true, direction: "asc" });

    expect(markup).toContain('aria-sort="ascending"');
    expect(markup).toContain("lucide lucide-arrow-up h-3.5 w-3.5");
    expect(markup).toContain("Ativar para ordenar em ordem decrescente");
  });

  it("renders the descending state and describes the ascending action", () => {
    const markup = renderHeader({ active: true, direction: "desc" });

    expect(markup).toContain('aria-sort="descending"');
    expect(markup).toContain("lucide lucide-arrow-down h-3.5 w-3.5");
    expect(markup).toContain("Ativar para ordenar em ordem crescente");
  });

  it("calls onSort from the semantic button", () => {
    const onSort = vi.fn();
    const header = SortableTableHeader({
      label: "Data",
      active: true,
      direction: "desc",
      onSort,
    });
    const button = header.props.children as ReactElement<{ onClick: () => void }>;

    button.props.onClick();

    expect(onSort).toHaveBeenCalledOnce();
  });
});
