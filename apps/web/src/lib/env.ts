import { parseClientEnv } from "./env-schema";

const rawClientEnv = {
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV?.trim(),
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL?.trim(),
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  VITE_EXPECTED_SUPABASE_REF: import.meta.env.VITE_EXPECTED_SUPABASE_REF?.trim(),
};

export const clientEnv = parseClientEnv(rawClientEnv);
