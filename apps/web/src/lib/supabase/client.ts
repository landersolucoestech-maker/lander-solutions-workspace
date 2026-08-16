import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { clientEnv } from "../env";
import { normalizeDevelopmentListReadResponse } from "./development-read-fallback";

const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

let browserClient: SupabaseClient | undefined;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<Response>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`O Supabase não respondeu em ${SUPABASE_REQUEST_TIMEOUT_MS / 1_000} segundos.`),
      );
    }, SUPABASE_REQUEST_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([fetch(input, init), timeout]);
    return normalizeDevelopmentListReadResponse(
      input,
      init,
      response,
      clientEnv.VITE_APP_ENV === "development" && !AUTHENTICATION_ENABLED,
      new URL(clientEnv.VITE_SUPABASE_URL).origin,
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

function createSupabaseClient(persistSession: boolean): SupabaseClient {
  return createClient(clientEnv.VITE_SUPABASE_URL, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession,
      autoRefreshToken: persistSession,
      detectSessionInUrl: persistSession,
      flowType: "pkce",
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    return createSupabaseClient(false);
  }

  browserClient ??= createSupabaseClient(true);
  return browserClient;
}
