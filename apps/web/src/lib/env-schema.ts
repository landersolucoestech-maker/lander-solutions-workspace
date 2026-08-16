import { z } from "zod";

const supabaseRefPattern = /^[a-z]{20}$/;
const supabaseHostnamePattern = /^([a-z]{20})\.supabase\.co$/;
const localSupabaseHosts = new Set(["127.0.0.1", "localhost"]);

export const clientEnvSchema = z.object({
  VITE_APP_ENV: z.enum(["development", "staging", "production"]),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  VITE_EXPECTED_SUPABASE_REF: z.union([
    z.string().regex(supabaseRefPattern),
    z.literal("lander-solutions"),
  ]),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const DEVELOPMENT_SUPABASE_REF = "jodzhcktrlwinywqgbab";
export const LOCAL_SUPABASE_REF = "lander-solutions";

export function extractSupabaseRef(url: string): string {
  const parsedUrl = new URL(url);
  const hostnameMatch = supabaseHostnamePattern.exec(parsedUrl.hostname);

  if (
    parsedUrl.protocol === "http:" &&
    localSupabaseHosts.has(parsedUrl.hostname) &&
    parsedUrl.port === "65421" &&
    parsedUrl.username === "" &&
    parsedUrl.password === "" &&
    (parsedUrl.pathname === "" || parsedUrl.pathname === "/") &&
    parsedUrl.search === "" &&
    parsedUrl.hash === ""
  ) {
    return LOCAL_SUPABASE_REF;
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.port !== "" ||
    (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/") ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== "" ||
    !hostnameMatch
  ) {
    throw new Error("VITE_SUPABASE_URL não aponta para um projeto Supabase válido.");
  }

  return hostnameMatch[1];
}

export function parseClientEnv(input: Record<string, unknown>): ClientEnv {
  const env = clientEnvSchema.parse(input);
  const actualRef = extractSupabaseRef(env.VITE_SUPABASE_URL);

  if (actualRef !== env.VITE_EXPECTED_SUPABASE_REF) {
    throw new Error(
      `Ambiente inconsistente: URL aponta para ${actualRef}, mas VITE_EXPECTED_SUPABASE_REF informa ${env.VITE_EXPECTED_SUPABASE_REF}.`,
    );
  }

  if (
    env.VITE_APP_ENV === "development" &&
    actualRef !== DEVELOPMENT_SUPABASE_REF &&
    actualRef !== LOCAL_SUPABASE_REF
  ) {
    throw new Error("Desenvolvimento deve utilizar a branch Supabase dev da LANDER SOLUTIONS.");
  }

  if (
    env.VITE_APP_ENV === "production" &&
    (actualRef === DEVELOPMENT_SUPABASE_REF || actualRef === LOCAL_SUPABASE_REF)
  ) {
    throw new Error("Produção não pode utilizar a branch Supabase de desenvolvimento.");
  }

  return env;
}
