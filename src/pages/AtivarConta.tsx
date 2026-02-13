import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sun, Lock, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLogo } from "@/hooks/useLogo";
import { z } from "zod";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Deve conter 1 letra maiúscula")
      .regex(/[0-9]/, "Deve conter 1 número"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

interface InviteInfo {
  vendedor_nome: string;
  telefone_masked: string;
  email: string;
}

type PageState = "loading" | "form" | "activating" | "success" | "error";

export default function AtivarConta() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logo = useLogo();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("Link de convite inválido. Verifique o link recebido.");
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Use anon key to validate token (public endpoint)
      const { data, error } = await supabase.functions.invoke("activate-vendor-account", {
        body: { token, password: "__validate_only__" },
      });

      // If we get a password validation error, the token is valid
      if (error || data?.error) {
        const msg = data?.error || "Erro ao validar convite";

        // Password validation errors mean the token IS valid
        if (msg.includes("senha") || msg.includes("password") || msg.includes("8 caracteres") || msg.includes("maiúscula") || msg.includes("número")) {
          // Token is valid, we just need a real password
          // We need to get invite info differently
          await fetchInviteInfo();
          return;
        }

        setState("error");
        setErrorMessage(msg);
        return;
      }

      // Shouldn't reach here with __validate_only__
      await fetchInviteInfo();
    } catch (err: any) {
      setState("error");
      setErrorMessage("Erro ao validar convite. Tente novamente.");
    }
  };

  const fetchInviteInfo = async () => {
    try {
      // Fetch invite info via a simple RPC or direct query
      // Since we can't query vendor_invites directly (RLS), we'll use the edge function
      // For now, show the form - the edge function will validate again on submit
      setState("form");
    } catch {
      setState("error");
      setErrorMessage("Erro ao carregar informações do convite.");
    }
  };

  const handleActivate = async () => {
    // Client-side validation
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errors[e.path[0]] = e.message;
      });
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    setState("activating");

    try {
      const { data, error } = await supabase.functions.invoke("activate-vendor-account", {
        body: { token, password },
      });

      if (error) {
        throw new Error("Erro ao ativar conta. Tente novamente.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.auto_login && data?.session) {
        // Set the session in Supabase client
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      setState("success");

      toast({
        title: "Conta ativada! 🎉",
        description: "Bem-vindo ao sistema. Redirecionando...",
      });

      // Redirect to vendor portal after brief delay
      setTimeout(() => {
        if (data?.auto_login) {
          navigate("/consultor", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      }, 2000);
    } catch (err: any) {
      setState("form");
      setErrorMessage(err.message);
      toast({
        title: "Erro ao ativar",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Error state
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Convite Inválido</h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={() => navigate("/auth", { replace: true })}>
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Sun className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <p className="text-sm text-muted-foreground">Validando convite...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-scale-in">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Conta Ativada!</h2>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o sistema...
            </p>
            <Spinner size="sm" className="mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img src={logo} alt="Logo" className="h-10 w-auto mx-auto mb-6" />
        </div>

        <Card className="border-border/40 shadow-lg">
          <CardContent className="pt-8 pb-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Ativar Sua Conta
              </h1>
              <p className="text-sm text-muted-foreground">
                Crie uma senha para acessar o sistema
              </p>
            </div>

            {/* Error message */}
            {errorMessage && state === "form" && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}

            {/* Password form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    className="pl-10"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setValidationErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    autoFocus
                  />
                </div>
                {validationErrors.password && (
                  <p className="text-xs text-destructive">{validationErrors.password}</p>
                )}
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className={password.length >= 8 ? "text-primary" : ""}>
                    8+ caracteres
                  </span>
                  <span>·</span>
                  <span className={/[A-Z]/.test(password) ? "text-primary" : ""}>
                    1 maiúscula
                  </span>
                  <span>·</span>
                  <span className={/[0-9]/.test(password) ? "text-primary" : ""}>
                    1 número
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a senha"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setValidationErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                  />
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>
                )}
              </div>

              <Button
                onClick={handleActivate}
                className="w-full h-11"
                disabled={state === "activating"}
              >
                {state === "activating" ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    Ativar Conta
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60">
          Já possui conta?{" "}
          <button
            onClick={() => navigate("/auth")}
            className="text-primary hover:underline font-medium"
          >
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
