import type { SupportWorkspace } from "../types";

export interface SupportEditorProps<T> {
  workspace: SupportWorkspace;
  record: T | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
