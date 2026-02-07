import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/auth";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PORTAL_PREFERENCE_KEY = "preferred_portal";
const ALLOWED_ROLES = ["admin", "gerente", "financeiro", "vendedor", "instalador"];

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkingRole, setCheckingRole] = useState(false);

  const isRecoveryFlow =
    searchParams.get("type") === "recovery" ||
    (typeof window !== "undefined" && window.location.hash.includes("type=recovery"));

  // Show message if redirected from protected route
  useEffect(() => {
    const redirectFrom = searchParams.get("from");
    if (redirectFrom) {
      const messages: Record<string, string> = {
        vendedor: "Faça login para acessar o Portal do Vendedor",
        admin: "Faça login para acessar o Painel Administrativo",
      };
      toast({
        title: "Login necessário",
        description: messages[redirectFrom] || "Faça login para continuar",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      // During password recovery, stay on /auth to allow the user to set a new password.
      if (!loading && user && !isRecoveryFlow) {
        setCheckingRole(true);
        try {
          const savedPreference = localStorage.getItem(PORTAL_PREFERENCE_KEY);
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          const isVendedor = roles?.some(r => r.role === "vendedor");
          const isAdmin = roles?.some(r => r.role === "admin" || r.role === "gerente" || r.role === "financeiro");
          const isInstalador = roles?.some(r => r.role === "instalador");

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

          // Instalador-only users go directly to installer portal
          if (isInstalador && !isAdmin && !isVendedor) {
            navigate("/instalador", { replace: true });
          } else if (isVendedor && !isAdmin && hasVendedorRecord) {
            navigate("/vendedor", { replace: true });
          } else {
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
  }, [user, loading, navigate, isRecoveryFlow]);

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse-soft">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Sun className="w-8 h-8 text-primary animate-spin-slow" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gradient-mesh">
      <Header showCalculadora={false} showAdmin={false}>
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Link>
      </Header>

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-md border-border/50 shadow-xl animate-scale-in">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sun className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Área Restrita
            </CardTitle>
            <CardDescription className="text-base">
              Faça login para acessar o sistema
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <AuthForm />
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}