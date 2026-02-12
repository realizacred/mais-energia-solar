import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Sun, Zap, Shield, TrendingDown, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLogo } from "@/hooks/useLogo";
import { useBrandSettings } from "@/hooks/useBrandSettings";

const PORTAL_PREFERENCE_KEY = "preferred_portal";
const ALLOWED_ROLES = ["admin", "gerente", "financeiro", "vendedor", "instalador"];

const features = [
  {
    icon: TrendingDown,
    text: "Economia de até 90% na conta de energia",
  },
  {
    icon: Shield,
    text: "Garantia de 25 anos nos equipamentos",
  },
  {
    icon: Zap,
    text: "Instalação rápida e profissional",
  },
];

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkingRole, setCheckingRole] = useState(false);
  const { settings } = useBrandSettings();
  const brandLogo = useLogo();
  const brandLogoWhite = useLogo({ onDarkBg: true });

  const isRecoveryFlow =
    searchParams.get("type") === "recovery" ||
    (typeof window !== "undefined" && window.location.hash.includes("type=recovery"));

  // Show message if redirected from protected route
  useEffect(() => {
    if (user || loading) return; // Don't show if already logged in or still loading
    const redirectFrom = searchParams.get("from");
    if (redirectFrom) {
      const messages: Record<string, string> = {
        vendedor: "Faça login para acessar o Portal do Consultor",
        admin: "Faça login para acessar o Painel Administrativo",
      };
      toast({
        title: "Login necessário",
        description: messages[redirectFrom] || "Faça login para continuar",
      });
    }
  }, [searchParams, user, loading]);

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      if (!loading && user && !isRecoveryFlow) {
        // If user came from /app (messaging PWA), always go back there
        const redirectFrom = searchParams.get("from");
        if (redirectFrom === "app") {
          navigate("/app", { replace: true });
          return;
        }

        setCheckingRole(true);
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("status, cargo_solicitado")
            .eq("user_id", user.id)
            .single();

          if (profile?.status === "pendente") {
            navigate("/aguardando-aprovacao", { replace: true });
            return;
          }
          if (profile?.status === "rejeitado") {
            toast({
              title: "Acesso negado",
              description: "Sua solicitação de acesso foi rejeitada. Contate o administrador.",
              variant: "destructive",
            });
            setCheckingRole(false);
            return;
          }

          const savedPreference = localStorage.getItem(PORTAL_PREFERENCE_KEY);
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          const isVendedor = roles?.some(r => r.role === "vendedor");
          const isAdmin = roles?.some(r => r.role === "admin" || r.role === "gerente" || r.role === "financeiro");
          const isInstalador = roles?.some(r => r.role === "instalador");

          if (!isVendedor && !isAdmin && !isInstalador) {
            setCheckingRole(false);
            if (profile) {
              navigate("/aguardando-aprovacao", { replace: true });
            } else {
              toast({
                title: "Acesso não autorizado",
                description: "Sua conta não possui permissões configuradas. Contate o administrador.",
                variant: "destructive",
              });
            }
            return;
          }

          let hasVendedorRecord = false;
          if (isVendedor) {
            const { data: vendedorData } = await supabase
              .from("vendedores")
              .select("id")
              .eq("user_id", user.id)
              .single();
            hasVendedorRecord = !!vendedorData;
          }

          if (isVendedor && isAdmin && hasVendedorRecord) {
            if (savedPreference === "vendedor") {
              navigate("/vendedor", { replace: true });
            } else if (savedPreference === "admin") {
              navigate("/admin", { replace: true });
            } else {
              navigate("/portal", { replace: true });
            }
            return;
          }

          if (isInstalador && !isAdmin && !isVendedor) {
            navigate("/instalador", { replace: true });
          } else if (isVendedor && !isAdmin && hasVendedorRecord) {
            navigate("/vendedor", { replace: true });
          } else if (isAdmin) {
            navigate("/admin", { replace: true });
          }
        } catch (error) {
          console.error("Error checking user role:", error);
          navigate("/admin", { replace: true });
        } finally {
          setCheckingRole(false);
        }
      }
    };

    checkUserRoleAndRedirect();
  }, [user, loading, navigate, isRecoveryFlow, searchParams]);

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse-soft">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Sun className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const loginImage = settings?.login_image_url;

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand / Visual */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/95 to-secondary/80" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary/5 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Login image if configured */}
        {loginImage && (
          <div className="absolute inset-0">
            <img 
              src={loginImage} 
              alt="" 
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo */}
          <div>
            <Link to="/" className="inline-block transition-opacity hover:opacity-80">
              <img
                src={brandLogoWhite}
                alt="Logo"
                className="h-10 xl:h-12 w-auto"
              />
            </Link>
          </div>

          {/* Hero message */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
                Gerencie seus projetos
                <br />
                de energia solar
                <span className="text-primary"> com eficiência.</span>
              </h1>
              <p className="text-secondary-foreground/60 text-base xl:text-lg max-w-md leading-relaxed">
                Plataforma completa para vendedores, instaladores e administradores da Mais Energia Solar.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                    <feature.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <span className="text-sm text-secondary-foreground/70 group-hover:text-secondary-foreground/90 transition-colors">
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom testimonial / trust */}
          <div className="space-y-4">
            <div className="h-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-secondary flex items-center justify-center"
                  >
                    <span className="text-[10px] font-bold text-primary">
                      {['ME', 'JS', 'RC'][i - 1]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-secondary-foreground/50">
                <span className="text-secondary-foreground/70 font-medium">+50 profissionais</span>{" "}
                já utilizam a plataforma
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Top bar - mobile */}
        <div className="flex items-center justify-between p-4 lg:p-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar</span>
          </Link>
          
          {/* Logo on mobile */}
          <Link to="/" className="lg:hidden">
            <img
              src={brandLogo}
              alt="Logo"
              className="h-8 w-auto"
            />
          </Link>
          
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8 lg:px-8">
          <div className="w-full max-w-[420px] space-y-8">
            {/* Header */}
            <div className="text-center lg:text-left space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto lg:mx-0 mb-4">
                <Sun className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                Área Restrita
              </h2>
              <p className="text-muted-foreground text-sm">
                Faça login para acessar o sistema de gestão
              </p>
            </div>

            {/* Auth card */}
            <Card className="border-border/40 shadow-lg bg-card">
              <CardContent className="p-6">
                <AuthForm />
              </CardContent>
            </Card>

            {/* Footer note */}
            <p className="text-center text-xs text-muted-foreground/60">
              © {new Date().getFullYear()} Mais Energia Solar · Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
