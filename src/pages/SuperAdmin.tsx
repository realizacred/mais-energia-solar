import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, LogOut, Building2,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SuperAdminTenantList } from "@/components/super-admin/SuperAdminTenantList";
import { SuperAdminTenantDetail } from "@/components/super-admin/SuperAdminTenantDetail";

export default function SuperAdmin() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?from=super-admin", { replace: true });
      return;
    }
    if (user) checkSuperAdmin();
  }, [user, authLoading]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const has = data?.some((r) => r.role === "super_admin");
    setIsSuperAdmin(!!has);
    setChecking(false);
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Spinner size="md" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground text-center">
              Apenas Super Admins podem acessar esta área.
            </p>
            <Button onClick={() => navigate("/admin")} variant="outline">Voltar ao Admin</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold">Super Admin</h1>
          <Badge variant="outline" className="text-xs">Platform Governance</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <PortalSwitcher />
          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {selectedTenantId ? (
          <SuperAdminTenantDetail
            tenantId={selectedTenantId}
            onBack={() => setSelectedTenantId(null)}
          />
        ) : (
          <SuperAdminTenantList
            onSelectTenant={(id) => setSelectedTenantId(id)}
          />
        )}
      </main>
    </div>
  );
}
