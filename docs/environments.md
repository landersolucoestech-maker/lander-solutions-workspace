# LANDER SOLUTIONS — Environment Strategy

The official technical environments are `development`, `staging`, and `production`.

Real local environment files use `apps/web/.env.development`, `apps/web/.env.staging`, and `apps/web/.env.production`. They are ignored by Git and may contain local or provider-injected values. Versioned templates use the matching `.example` suffix under `apps/web/` and must not contain secrets.

## Ownership

- **Web public:** `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_EXPECTED_SUPABASE_REF`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. These values are consumed by browser code and must be treated as public.
- **Server-only:** administrative secrets such as `SUPABASE_SERVICE_ROLE_KEY`. They must never use a `VITE_` prefix and do not belong in web templates.
- **Supabase Edge Functions:** server-side variables such as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_ORIGIN` remain owned by Supabase infrastructure until the backend boundary is explicitly redesigned.
- **CI/build:** environment selection and non-secret validation values are supplied by the CI/deploy provider as needed.
- **Database tests:** `VALIDATION_PROFILE` accepts `development`, `staging`, or `production`; validation remains local unless a later stage explicitly authorizes an external environment.

`apps/web` and `apps/api` are structural boundaries only in Stage 3. Frontend source now lives under `apps/web/src/`, and existing TanStack Start server entry plus Supabase infrastructure remain in their current locations.
