/**
 * SuperAdminLayout — Shell do painel: guard de acesso + sidebar + outlet.
 * RB-76: substitui o antigo state-based switch da página SuperAdmin por rotas reais.
 */
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, ShieldAlert, Building2 } from "lucide-react";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui-kit";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminGuard } from "@/hooks/super-admin/useSuperAdminGuard";
import { SuperAdminSidebar } from "./SuperAdminSidebar";

export function SuperAdminLayout() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, isChecking } = useSuperAdminGuard();
  const navigate = useNavigate();

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Verificando acesso..." />
      </div>
    );
  }

  if (!user) {
    navigate("/auth?from=super-admin", { replace: true });
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <h2 className="text-xl font-bold">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground text-center">
              Apenas Super Admins podem acessar esta área.
            </p>
            <Button onClick={() => navigate("/admin")} variant="ghost">
              Voltar ao Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <SuperAdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 bg-background border-b h-14 flex items-center justify-between px-3 md:px-4 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <Building2 className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-base font-semibold font-display truncate">
                Super Admin
              </h1>
              <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
                Platform Governance
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[180px]">
                {user?.email}
              </span>
              <PortalSwitcher />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                aria-label="Sair"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
