import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, Settings, ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import logo from "@/assets/logo.png";

const PORTAL_PREFERENCE_KEY = "preferred_portal";

interface PortalAccess {
  vendedor: boolean;
  admin: boolean;
  vendedorRecord: boolean;
  instalador: boolean;
}

export default function PortalSelector() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<PortalAccess>({ vendedor: false, admin: false, vendedorRecord: false, instalador: false });
  const [rememberChoice, setRememberChoice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (user) {
      checkAccessAndPreference();
    }
  }, [user, authLoading, navigate]);

  const checkAccessAndPreference = async () => {
    if (!user) return;

    try {
      // Check for saved preference
      const savedPreference = localStorage.getItem(PORTAL_PREFERENCE_KEY);
      
      // Get user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isVendedor = roles?.some(r => r.role === "vendedor");
      const isAdmin = roles?.some(r => r.role === "admin" || r.role === "gerente" || r.role === "financeiro");
      const isInstalador = roles?.some(r => r.role === "instalador");

      // Check if user has vendedor record
      let hasVendedorRecord = false;
      if (isVendedor) {
        const { data: vendedorData } = await supabase
          .from("vendedores")
          .select("id")
          .eq("user_id", user.id)
          .single();
        hasVendedorRecord = !!vendedorData;
      }

      setAccess({
        vendedor: isVendedor || false,
        admin: isAdmin || false,
        vendedorRecord: hasVendedorRecord,
        instalador: isInstalador || false,
      });

      // If only one option available, redirect directly
      // Admins can access both portals (vendor portal shows all leads for admins)
      if (isAdmin) {
        // Admin has access to both - continue to show selector
        // unless they only have admin role (no vendedor role)
        if (!isVendedor) {
          navigate("/admin", { replace: true });
          return;
        }
      } else if (isInstalador && !isVendedor) {
        // Instalador-only users go directly to installer portal
        navigate("/instalador", { replace: true });
        return;
      } else if (isVendedor && hasVendedorRecord) {
        // Vendedor-only users go directly to vendor portal
        navigate("/vendedor", { replace: true });
        return;
      } else {
        // No valid role, redirect to auth
        navigate("/auth", { replace: true });
        return;
      }

      // If saved preference exists and valid, redirect
      if (savedPreference) {
        if (savedPreference === "vendedor" && isVendedor && hasVendedorRecord) {
          navigate("/vendedor", { replace: true });
          return;
        }
        if (savedPreference === "admin" && isAdmin) {
          navigate("/admin", { replace: true });
          return;
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/admin", { replace: true });
    }
  };

  const handleSelectPortal = (portal: "vendedor" | "admin") => {
    if (rememberChoice) {
      localStorage.setItem(PORTAL_PREFERENCE_KEY, portal);
    }
    navigate(`/${portal}`, { replace: true });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <Header showCalculadora={false} showAdmin={false} />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <img src={logo} alt="Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">
              Bem-vindo de volta!
            </h1>
            <p className="text-muted-foreground">
              Escolha qual portal deseja acessar
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Vendedor Portal Card */}
            {(access.vendedor || access.admin) && (
              <Card 
                className="cursor-pointer group hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:scale-[1.02]"
                onClick={() => handleSelectPortal("vendedor")}
              >
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Portal do Vendedor</CardTitle>
                  <CardDescription>
                    Acompanhe seus leads e vendas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Visualizar leads captados
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Gerenciar status de leads
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Compartilhar link de indicação
                    </li>
                  </ul>
                  <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground" variant="outline">
                    Acessar Portal
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Admin Portal Card */}
            {access.admin && (
              <Card 
                className="cursor-pointer group hover:shadow-lg transition-all duration-300 hover:border-primary/50 hover:scale-[1.02]"
                onClick={() => handleSelectPortal("admin")}
              >
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3 group-hover:bg-secondary transition-colors">
                    <Settings className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-xl">Painel Administrativo</CardTitle>
                  <CardDescription>
                    Gerencie todo o sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Gerenciar leads e clientes
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Configurar vendedores
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Acessar relatórios e dashboards
                    </li>
                  </ul>
                  <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground" variant="outline">
                    Acessar Painel
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Remember Choice */}
          <div className="flex items-center justify-center gap-2">
            <Checkbox 
              id="remember" 
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked === true)}
            />
            <Label 
              htmlFor="remember" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Lembrar minha escolha para próximos acessos
            </Label>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Export utility to clear preference
export const clearPortalPreference = () => {
  localStorage.removeItem(PORTAL_PREFERENCE_KEY);
};
