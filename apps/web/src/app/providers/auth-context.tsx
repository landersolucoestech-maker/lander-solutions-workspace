import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AUTHENTICATION_ENABLED } from "@/config/authentication";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthGateState =
  | "loading"
  | "anonymous"
  | "pending"
  | "blocked"
  | "mfa-enrollment"
  | "mfa-challenge"
  | "authenticated"
  | "error";

export interface AuthProfile {
  id: string;
  email: string | null;
  display_name: string;
  status: "pending" | "active" | "suspended" | "inactive";
  mfa_required: boolean;
  last_seen_at: string | null;
  version: number;
}

interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  gate: AuthGateState;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  startTotpEnrollment: () => Promise<TotpEnrollment>;
  verifyTotpEnrollment: (factorId: string, code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const isDevelopmentEnvironment = import.meta.env.VITE_APP_ENV === "development";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [gate, setGate] = useState<AuthGateState>("loading");
  const [error, setError] = useState<string | null>(null);

  const clearAuthenticatedState = useCallback(() => {
    if (AUTHENTICATION_ENABLED) queryClient.clear();
    setSession(null);
    setUser(null);
    setProfile(null);
    setGate("anonymous");
  }, [queryClient]);

  const synchronize = useCallback(
    async (candidateSession: Session | null) => {
      if (!candidateSession) {
        clearAuthenticatedState();
        setError(null);
        return;
      }

      const client = getSupabaseBrowserClient();
      setGate("loading");
      setError(null);

      const [{ data: userResult, error: userError }, assuranceResult] = await Promise.all([
        client.auth.getUser(),
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (userError || !userResult.user) {
        await client.auth.signOut({ scope: "local" });
        clearAuthenticatedState();
        setError(userError?.message ?? "A sessão não pôde ser validada.");
        return;
      }

      if (assuranceResult.error) {
        setGate("error");
        setError(assuranceResult.error.message);
        return;
      }

      const { data: profileResult, error: profileError } = await client
        .from("profiles")
        .select("id,email,display_name,status,mfa_required,last_seen_at,version")
        .eq("id", userResult.user.id)
        .single();

      if (profileError || !profileResult) {
        setSession(candidateSession);
        setUser(userResult.user);
        setProfile(null);
        setGate("error");
        setError(profileError?.message ?? "O perfil corporativo não foi encontrado.");
        return;
      }

      const currentProfile = profileResult as AuthProfile;
      setSession(candidateSession);
      setUser(userResult.user);
      setProfile(currentProfile);

      if (currentProfile.status === "pending") {
        setGate("pending");
        return;
      }

      if (currentProfile.status !== "active") {
        setGate("blocked");
        return;
      }

      if (isDevelopmentEnvironment || !currentProfile.mfa_required) {
        setGate("authenticated");
        return;
      }

      const currentLevel = assuranceResult.data.currentLevel;
      const nextLevel = assuranceResult.data.nextLevel;

      if (currentLevel === "aal2") {
        setGate("authenticated");
        return;
      }

      if (nextLevel === "aal2") {
        setGate("mfa-challenge");
        return;
      }

      setGate("mfa-enrollment");
    },
    [clearAuthenticatedState],
  );

  const refresh = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      setGate("error");
      setError(sessionError.message);
      return;
    }

    await synchronize(data.session);
  }, [synchronize]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    let active = true;

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setGate("error");
        setError(sessionError.message);
        return;
      }
      void synchronize(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (active) void synchronize(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [synchronize]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    setGate("loading");
    setError(null);

    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) {
      setGate("anonymous");
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    clearAuthenticatedState();
    setError(null);
  }, [clearAuthenticatedState]);

  const verifyMfa = useCallback(
    async (code: string) => {
      const client = getSupabaseBrowserClient();
      setError(null);

      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const factor =
        factors.data.totp.find((item) => item.status === "verified") ??
        factors.data.phone.find((item) => item.status === "verified");

      if (!factor) {
        throw new Error("Nenhum fator MFA verificado foi encontrado.");
      }

      const challenge = await client.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) throw challenge.error;

      const verification = await client.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code,
      });
      if (verification.error) throw verification.error;

      await refresh();
    },
    [refresh],
  );

  const startTotpEnrollment = useCallback(async (): Promise<TotpEnrollment> => {
    const client = getSupabaseBrowserClient();
    setError(null);

    const enrollment = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "LANDER SOLUTIONS",
    });
    if (enrollment.error) throw enrollment.error;

    return {
      factorId: enrollment.data.id,
      qrCode: enrollment.data.totp.qr_code,
      secret: enrollment.data.totp.secret,
    };
  }, []);

  const verifyTotpEnrollment = useCallback(
    async (factorId: string, code: string) => {
      const client = getSupabaseBrowserClient();
      setError(null);

      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verification = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verification.error) throw verification.error;

      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      gate,
      error,
      signIn,
      signOut,
      refresh,
      verifyMfa,
      startTotpEnrollment,
      verifyTotpEnrollment,
    }),
    [
      session,
      user,
      profile,
      gate,
      error,
      signIn,
      signOut,
      refresh,
      verifyMfa,
      startTotpEnrollment,
      verifyTotpEnrollment,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  return context;
}
