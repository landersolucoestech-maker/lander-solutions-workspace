import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function AuthGate({ children }: { children: ReactNode }) {
  const { gate } = useAuth();

  if (gate === "loading") return <LoadingScreen />;
  if (gate === "anonymous") return <LoginScreen />;
  if (gate === "pending") return <AccountStateScreen pending />;
  if (gate === "blocked") return <AccountStateScreen pending={false} />;
  if (gate === "mfa-enrollment") return <TotpEnrollmentScreen />;
  if (gate === "mfa-challenge") return <MfaChallengeScreen />;
  if (gate === "error") return <ErrorScreen />;

  return children;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <AuthFrame>
      <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Validando sessão e permissões…
      </div>
    </AuthFrame>
  );
}

function LoginScreen() {
  const { signIn, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle>LANDER SOLUTIONS</CardTitle>
          <CardDescription>Acesso restrito ao sistema corporativo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {(error ?? authError) && (
              <p role="alert" className="text-sm text-destructive">
                {error ?? authError}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function AccountStateScreen({ pending }: { pending: boolean }) {
  const { profile, signOut } = useAuth();

  return (
    <AuthFrame>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <CardTitle>{pending ? "Acesso aguardando ativação" : "Acesso bloqueado"}</CardTitle>
          <CardDescription>
            {pending
              ? "O usuário foi autenticado, mas ainda não possui uma atribuição ativa no sistema corporativo."
              : "O perfil está suspenso ou inativo e não pode acessar os dados corporativos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function MfaChallengeScreen() {
  const { verifyMfa, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await verifyMfa(code.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O código não pôde ser validado.");
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Confirmação em duas etapas</CardTitle>
          <CardDescription>Informe o código atual do seu autenticador.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de verificação</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={submitting || code.length < 6}>
              {submitting && <LoaderCircle className="animate-spin" />}
              Verificar
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function TotpEnrollmentScreen() {
  const { startTotpEnrollment, verifyTotpEnrollment, signOut } = useAuth();
  const started = useRef(false);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void startTotpEnrollment()
      .then((enrollment) => {
        setFactorId(enrollment.factorId);
        setQrCode(enrollment.qrCode);
        setSecret(enrollment.secret);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o MFA.");
      })
      .finally(() => setLoading(false));
  }, [startTotpEnrollment]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await verifyTotpEnrollment(factorId, code.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O código não pôde ser validado.");
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <CardTitle>Ative a autenticação em duas etapas</CardTitle>
          <CardDescription>
            Este perfil exige MFA. Leia o QR Code em um aplicativo autenticador e confirme o código.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin" /> Preparando o autenticador…
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {qrCode && (
                <div className="flex justify-center rounded-sm border bg-white p-4">
                  <img
                    src={qrCode}
                    alt="QR Code para configurar o autenticador"
                    className="size-52"
                  />
                </div>
              )}
              {secret && (
                <div className="rounded-sm bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Chave manual</p>
                  <p className="num mt-1 break-all text-sm">{secret}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="enrollment-code">Código de verificação</Label>
                <Input
                  id="enrollment-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={submitting || !factorId || code.length < 6}
              >
                {submitting && <LoaderCircle className="animate-spin" />}
                Ativar MFA
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void signOut()}
              >
                Sair
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function ErrorScreen() {
  const { error, refresh, signOut } = useAuth();

  return (
    <AuthFrame>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <CardTitle>Falha ao validar o acesso</CardTitle>
          <CardDescription>
            {error ?? "O estado de autenticação não pôde ser carregado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button onClick={() => void refresh()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Encerrar sessão
          </Button>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
