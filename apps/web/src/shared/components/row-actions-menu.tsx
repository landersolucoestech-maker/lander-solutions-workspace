import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewDisabled?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  align?: "start" | "center" | "end";
}

export function RowActionsMenu({
  onView,
  onEdit,
  onDelete,
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  align = "end",
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Abrir ações do registro"
          data-standard-row-actions="true"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-40" data-standard-row-actions="true">
        {onView && (
          <DropdownMenuItem disabled={viewDisabled} onSelect={onView}>
            <Eye className="h-4 w-4" /> Ver
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem disabled={editDisabled} onSelect={onEdit}>
            <Pencil className="h-4 w-4" /> Editar
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={deleteDisabled}
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
