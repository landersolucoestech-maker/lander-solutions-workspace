import { SupportApiError } from "./api";

export function supportErrorMessage(error: unknown) {
  if (error instanceof SupportApiError) {
    return error.requestId ? `${error.message} (requisição ${error.requestId})` : error.message;
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}
