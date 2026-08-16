export async function normalizeDevelopmentListReadResponse(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  response: Response,
  enabled: boolean,
  supabaseOrigin: string,
): Promise<Response> {
  if (!enabled || (response.status !== 401 && response.status !== 403)) return response;

  const request = new Request(input, init);
  const url = new URL(request.url);
  const accept = request.headers.get("accept") ?? "";
  const isListRead =
    request.method === "GET" &&
    url.origin === supabaseOrigin &&
    url.pathname.startsWith("/rest/v1/") &&
    !url.pathname.startsWith("/rest/v1/rpc/") &&
    url.searchParams.has("select") &&
    !accept.includes("application/vnd.pgrst.object");

  if (!isListRead) return response;

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  if (payload?.code !== "42501") return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("content-range", "*/0");
  return new Response("[]", { status: 200, headers });
}
