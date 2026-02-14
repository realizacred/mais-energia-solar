import { useEffect, useMemo, useState } from "react";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { useForm } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, CheckCircle, KeyRound, ArrowRight, Sparkles, ArrowLeft, User, Briefcase } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { loginSchema, LoginData, signupSchema, SignupData } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .regex(/[A-Z]/, "Deve conter pelo menos 1 letra maiúscula")
      .regex(/[0-9]/, "Deve conter pelo menos 1 número"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type NewPasswordData = z.infer<typeof newPasswordSchema>;

type RecoveryStep = "idle" | "email_sent" | "new_password" | "success";

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("idle");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Check for logout reason from sessionStorage
  useEffect(() => {
    const reason = sessionStorage.getItem("logout_reason");
    if (reason) {
      setLogoutReason(reason);
      sessionStorage.removeItem("logout_reason");
    }
  }, []);

  const isRecoveryFlow = useMemo(() => {
    const hash = window.location.hash ?? "";
    const search = window.location.search ?? "";
    return /type=recovery/i.test(hash) || /type=recovery/i.test(search);
  }, []);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event - this fires when Supabase processes the token
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setRecoveryStep("new_password");
      }
    });

    // If we detect recovery flow in URL, check if we already have a session
    if (isRecoveryFlow) {
      // Show loading state while Supabase processes the token from URL
      setRecoveryStep("new_password");
      
      // Check if session already exists (page refresh scenario)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setHasRecoverySession(true);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [isRecoveryFlow]);

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      cargo: "consultor",
    },
  });

  const newPasswordForm = useForm<NewPasswordData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleUpdatePassword = async (data: NewPasswordData) => {
    // Ensure we have a valid session before updating
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast({
        title: "Sessão expirada",
        description: "Por favor, solicite um novo link de redefinição de senha.",
        variant: "destructive",
      });
      setRecoveryStep("idle");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast({
          title: "Erro ao atualizar senha",
          description: error.message || "Não foi possível atualizar a senha. Tente novamente.",
          variant: "destructive",
        });
      } else {
        setRecoveryStep("success");
        toast({
          title: "Senha atualizada! 🎉",
          description: "Sua senha foi alterada com sucesso.",
        });

        // Remove recovery tokens from the URL
        try {
          window.history.replaceState({}, document.title, "/auth");
        } catch {
          // ignore
        }

        // Redireciona após alguns segundos
        setTimeout(() => {
          setRecoveryStep("idle");
          setRecoveryEmail("");
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email necessário",
        description: "Digite seu email para receber o link de recuperação.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getPublicUrl()}/auth?type=recovery`,
      });

      if (error) {
        // Handle rate limiting errors specifically
        const isRateLimited = error.message.includes("security purposes") || 
                              error.message.includes("rate") ||
                              error.message.includes("email rate limit") ||
                              (error as any).status === 429;
        
        if (isRateLimited) {
          // Still show the "email sent" screen to prevent email enumeration
          // and provide a better user experience
          setRecoveryEmail(email);
          setRecoveryStep("email_sent");
          toast({
            title: "Verifique sua caixa de entrada",
            description: "Se um email de recuperação já foi enviado, aguarde alguns minutos antes de solicitar novamente.",
          });
          return;
        }
        
        toast({
          title: "Erro",
          description: "Não foi possível enviar o email. Tente novamente.",
          variant: "destructive",
        });
      } else {
        setRecoveryEmail(email);
        setRecoveryStep("email_sent");
        toast({
          title: "Email enviado! 📧",
          description: "Abra o email e clique no link para redefinir sua senha.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRecoveryStep("idle");
    setRecoveryEmail("");

    // Clear any recovery tokens that might be present in the URL
    try {
      window.history.replaceState({}, document.title, "/auth");
    } catch {
      // ignore
    }
  };

  const handleSignIn = async (data: LoginData) => {
    setIsLoading(true);
    try {
      let loginEmail = data.email;

      // If input looks like a phone number, resolve to email
      const digitsOnly = data.email.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && !data.email.includes("@")) {
        const { data: resolvedEmail, error: resolveError } = await supabase.rpc(
          "resolve_phone_to_email",
          { _phone: data.email }
        );

        if (resolveError || !resolvedEmail) {
          toast({
            title: "Telefone não encontrado",
            description: "Nenhuma conta vinculada a este telefone. Use seu email.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        loginEmail = resolvedEmail;
      }

      const { error } = await signIn(loginEmail, data.password);
      if (error) {
        let message = "Erro ao fazer login. Tente novamente.";
        if (error.message.includes("Invalid login credentials")) {
          message = "Email/telefone ou senha incorretos.";
        } else if (error.message.includes("Email not confirmed")) {
          message = "Por favor, confirme seu email antes de fazer login.";
        }
        toast({
          title: "Erro no login",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: SignupData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password);
      if (error) {
        let message = "Erro ao criar conta. Tente novamente.";
        if (error.message.includes("User already registered")) {
          message = "Este email já está cadastrado.";
        } else if (error.message.includes("Password should be")) {
          message = "A senha deve ter pelo menos 6 caracteres.";
        }
        toast({
          title: "Erro no cadastro",
          description: message,
          variant: "destructive",
        });
        return;
      }

      // Create profile with pending status
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase.from("profiles").upsert({
          user_id: newUser.id,
          nome: data.nome,
          status: "pendente",
          cargo_solicitado: data.cargo,
        }, { onConflict: "user_id" });
      }

      toast({
        title: "Conta criada! 🎉",
        description: "Verifique seu email para confirmar o cadastro. Após confirmação, um administrador aprovará seu acesso.",
      });
      signupForm.reset();
    } finally {
      setIsLoading(false);
    }
  };

  // Tela de sucesso
  if (recoveryStep === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Senha Atualizada!
        </h3>
        <p className="text-sm text-muted-foreground">
          Você já pode fazer login com sua nova senha.
        </p>
      </div>
    );
  }

  // Tela informando que o email foi enviado
  if (recoveryStep === "email_sent") {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          type="button"
          onClick={handleBackToLogin}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>

        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Verifique seu Email
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Enviamos um link de redefinição para <strong>{recoveryEmail}</strong>
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Abra o email e clique no link para continuar. Se não encontrar, verifique o spam/lixo eletrônico.
          </p>

          <Button
            type="button"
            onClick={handleBackToLogin}
            className="w-full h-11"
            disabled={isLoading}
            variant="outline"
          >
            Voltar ao login
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <button
            type="button"
            onClick={handleRequestPasswordReset}
            className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Reenviar email
          </button>
        </div>
      </div>
    );
  }

  // Tela de definição de nova senha
  if (recoveryStep === "new_password") {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          type="button"
          onClick={handleBackToLogin}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>

        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Definir Nova Senha
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Digite sua nova senha abaixo
          </p>
        </div>

        <Form {...newPasswordForm}>
          <form
            onSubmit={newPasswordForm.handleSubmit(handleUpdatePassword)}
            className="space-y-4"
          >
            <FormField
              control={newPasswordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={newPasswordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Confirmar Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Repita a senha"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  Atualizar Senha
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {logoutReason && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Acesso revogado</p>
            <p className="text-muted-foreground mt-1">{logoutReason}</p>
          </div>
        </div>
      )}
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-11 p-1 bg-muted/50">
          <TabsTrigger value="login" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg font-medium">
            Entrar
          </TabsTrigger>
          <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg font-medium">
            Criar Conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="animate-fade-in">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email ou Telefone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="seu@email.com ou (00) 00000-0000"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleRequestPasswordReset}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 underline-offset-4 hover:underline"
                  disabled={isLoading}
                >
                  Esqueceu sua senha?
                </button>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="signup" className="animate-fade-in">
          <Form {...signupForm}>
            <form onSubmit={signupForm.handleSubmit(handleSignUp)} className="space-y-4">
              <FormField
                control={signupForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Nome completo</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Seu nome completo"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Cargo desejado
                      </div>
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:border-primary/50 transition-colors">
                          <RadioGroupItem value="consultor" id="consultor" />
                          <Label htmlFor="consultor" className="cursor-pointer text-sm">
                            Consultor
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:border-primary/50 transition-colors">
                          <RadioGroupItem value="instalador" id="instalador" />
                          <Label htmlFor="instalador" className="cursor-pointer text-sm">
                            Instalador
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground text-center">
                Após criar a conta, um administrador precisará aprovar seu acesso.
              </p>

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Criar Conta
                  </>
                )}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}