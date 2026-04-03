import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const ACCESS_ROLES = ["admin", "gerente", "financeiro", "consultor", "vendedor", "instalador", "super_admin"];
const PORTAL_PREFERENCE_KEY = "preferred_portal";

export default function PendingApproval() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!user) return;

    const checkApproval = async () => {
      const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),
      ]);

      if (profileError || rolesError) {
        console.warn("[PendingApproval] Failed to verify approval status:", profileError?.message || rolesError?.message);
        return;
      }

      const userRoles = (roles ?? []).map((entry) => entry.role as string);
      const hasGrantedRole = userRoles.some((role) => ACCESS_ROLES.includes(role));

      if (profile?.status === "aprovado" || hasGrantedRole) {
        const isSuperAdmin = userRoles.includes("super_admin");
        const isVendedor = userRoles.some((role) => role === "consultor" || role === "vendedor");
        const isAdmin = userRoles.some((role) => role === "admin" || role === "gerente" || role === "financeiro");
        const isInstalador = userRoles.includes("instalador");

        let hasVendedorRecord = false;
        if (isVendedor) {
          const { data: vendedorData, error: vendedorError } = await (supabase as any)
            .from("consultores")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (vendedorError) {
            console.warn("[PendingApproval] Failed to verify consultor record:", vendedorError.message);
            return;
          }

          hasVendedorRecord = !!vendedorData;
        }

        const savedPreference = localStorage.getItem(PORTAL_PREFERENCE_KEY);

        if (isVendedor && isAdmin && hasVendedorRecord) {
          if (savedPreference === "vendedor") {
            navigate("/consultor", { replace: true });
          } else if (savedPreference === "admin") {
            navigate("/admin", { replace: true });
          } else {
            navigate("/portal", { replace: true });
          }
          return;
        }

        if (isSuperAdmin && !isAdmin && !isVendedor && !isInstalador) {
          navigate("/super-admin", { replace: true });
        } else if (isInstalador && !isAdmin && !isVendedor) {
          navigate("/instalador", { replace: true });
        } else if (isVendedor && !isAdmin && hasVendedorRecord) {
          navigate("/consultor", { replace: true });
        } else if (isAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      }
    };

    checkApproval();
    const interval = setInterval(checkApproval, 10000);
    return () => clearInterval(interval);
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header showCalculadora={false} showAdmin={false} />

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-md">
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Aguardando Aprovação
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sua conta foi criada com sucesso! Um administrador precisa aprovar
              seu acesso antes que você possa utilizar o sistema. Você receberá
              acesso assim que for aprovado.
            </p>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="mt-2 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
