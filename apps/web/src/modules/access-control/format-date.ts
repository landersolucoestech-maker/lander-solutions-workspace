export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(value.length > 10 ? { timeStyle: "short" as const } : {}),
  }).format(parsed);
}
