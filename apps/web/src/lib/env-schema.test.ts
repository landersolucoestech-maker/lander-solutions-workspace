import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_SUPABASE_REF,
  LOCAL_SUPABASE_REF,
  extractSupabaseRef,
  parseClientEnv,
} from "./env-schema";

const publishableKey = "sb_publishable_test_key_with_safe_length";
const alternateSupabaseRef = "aaaaaaaaaaaaaaaaaaaa";

describe("environment guard", () => {
  it("accepts the development Supabase branch", () => {
    const env = parseClientEnv({
      VITE_APP_ENV: "development",
      VITE_SUPABASE_URL: `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      VITE_EXPECTED_SUPABASE_REF: DEVELOPMENT_SUPABASE_REF,
    });

    expect(env.VITE_EXPECTED_SUPABASE_REF).toBe(DEVELOPMENT_SUPABASE_REF);
  });

  it("accepts the project-scoped local Supabase stack in development", () => {
    const env = parseClientEnv({
      VITE_APP_ENV: "development",
      VITE_SUPABASE_URL: "http://127.0.0.1:65421",
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      VITE_EXPECTED_SUPABASE_REF: LOCAL_SUPABASE_REF,
    });

    expect(env.VITE_EXPECTED_SUPABASE_REF).toBe(LOCAL_SUPABASE_REF);
  });

  it("rejects a non-development project in development", () => {
    expect(() =>
      parseClientEnv({
        VITE_APP_ENV: "development",
        VITE_SUPABASE_URL: `https://${alternateSupabaseRef}.supabase.co`,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        VITE_EXPECTED_SUPABASE_REF: alternateSupabaseRef,
      }),
    ).toThrow("Desenvolvimento deve utilizar");
  });

  it("rejects a URL and expected ref mismatch", () => {
    expect(() =>
      parseClientEnv({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: `https://${alternateSupabaseRef}.supabase.co`,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        VITE_EXPECTED_SUPABASE_REF: DEVELOPMENT_SUPABASE_REF,
      }),
    ).toThrow("Ambiente inconsistente");
  });

  it("rejects the development branch in production", () => {
    expect(() =>
      parseClientEnv({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co`,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        VITE_EXPECTED_SUPABASE_REF: DEVELOPMENT_SUPABASE_REF,
      }),
    ).toThrow("Produção não pode utilizar");
  });

  it("extracts a valid Supabase project ref", () => {
    expect(extractSupabaseRef(`https://${DEVELOPMENT_SUPABASE_REF}.supabase.co`)).toBe(
      DEVELOPMENT_SUPABASE_REF,
    );
  });

  it("extracts the local project identifier from the configured local API URL", () => {
    expect(extractSupabaseRef("http://127.0.0.1:65421")).toBe(LOCAL_SUPABASE_REF);
  });

  it.each([
    `http://${DEVELOPMENT_SUPABASE_REF}.supabase.co`,
    `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co.evil.example`,
    `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co:4443`,
    `https://user:password@${DEVELOPMENT_SUPABASE_REF}.supabase.co`,
    `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co/rest/v1`,
    `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co?redirect=evil`,
    `https://${DEVELOPMENT_SUPABASE_REF}.supabase.co#fragment`,
  ])("rejects an unsafe or non-canonical Supabase URL: %s", (url) => {
    expect(() => extractSupabaseRef(url)).toThrow(
      "VITE_SUPABASE_URL não aponta para um projeto Supabase válido.",
    );
  });
});
