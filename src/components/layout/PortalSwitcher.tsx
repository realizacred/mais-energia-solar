import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeftRight, Users, Settings, Wrench, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { clearPortalPreference } from "@/pages/PortalSelector";
import { useQuery } from "@tanstack/react-query";

interface PortalAccess {
  consultor: boolean;
  admin: boolean;
  instalador: boolean;
  consultorRecord: boolean;
  superAdmin: boolean;
}

interface Consultor {
  id: string;
  nome: string;
  codigo: string;
  slug: string;
}

interface InstaladorProfile {
  id: string;
  nome: string;
  user_id: string;
}

async function fetchPortalAccess(userId: string): Promise<{
  access: PortalAccess;
  consultores: Consultor[];
  instaladores: InstaladorProfile[];
}> {
  // 1. Fetch roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const isConsultor = roles?.some(r => r.role === "consultor" || r.role === ("vendedor" as any)) || false;
  const isAdmin = roles?.some(r => r.role === "admin" || r.role === "gerente" || r.role === "financeiro") || false;
  const isInstalador = roles?.some(r => r.role === "instalador") || false;
  const isSuperAdmin = roles?.some(r => r.role === "super_admin") || false;

  // 2. Parallel fetches based on roles
  const promises: Promise<any>[] = [];

  // Check consultor record
  let hasConsultorRecord = false;
  if (isConsultor) {
    promises.push(
      (supabase as any)
        .from("consultores")
        .select("id")
        .eq("user_id", userId)
        .single()
        .then((r: any) => { hasConsultorRecord = !!r.data; })
    );
  }

  let consultores: Consultor[] = [];
  let instaladores: InstaladorProfile[] = [];

  if (isAdmin) {
    promises.push(
      (supabase as any)
        .from("consultores")
        .select("id, nome, codigo, slug")
        .eq("ativo", true)
        .order("nome")
        .then((r: any) => { consultores = r.data || []; })
    );

    promises.push(
      (async () => {
        const rolesRes = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "instalador");
        const ids = rolesRes.data?.map(r => r.user_id) || [];
        if (ids.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("id, nome, user_id")
            .eq("ativo", true)
            .in("user_id", ids)
            .order("nome");
          instaladores = (data as InstaladorProfile[]) || [];
        }
      })()
    );
  }

  await Promise.all(promises);

  return {
    access: {
      consultor: isConsultor,
      admin: isAdmin,
      instalador: isInstalador,
      consultorRecord: hasConsultorRecord,
      superAdmin: isSuperAdmin,
    },
    consultores,
    instaladores,
  };
}

export function PortalSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showConsultorDialog, setShowConsultorDialog] = useState(false);
  const [showInstaladorDialog, setShowInstaladorDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-access", user?.id],
    queryFn: () => fetchPortalAccess(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min cache — roles rarely change
    gcTime: 10 * 60 * 1000,
  });

  const access = data?.access ?? { consultor: false, admin: false, instalador: false, consultorRecord: false, superAdmin: false };
  const consultores = data?.consultores ?? [];
  const instaladores = data?.instaladores ?? [];

  const currentPortal = (location.pathname.startsWith("/consultor") || location.pathname.startsWith("/vendedor"))
    ? "consultor"
    : location.pathname.startsWith("/instalador") || location.pathname.startsWith("/checklist")
    ? "instalador"
    : "admin";

  const handleSwitchToAdmin = () => navigate("/admin");

  const handleSwitchToInstalador = () => {
    if (access.admin && !access.instalador && instaladores.length > 1) {
      setShowInstaladorDialog(true);
    } else if (access.admin && instaladores.length === 1) {
      navigate(`/instalador?as=${instaladores[0].user_id}`);
    } else {
      navigate("/instalador");
    }
  };

  const handleSelectInstalador = (userId: string) => {
    setShowInstaladorDialog(false);
    navigate(`/instalador?as=${userId}`);
  };

  const handleSwitchToConsultor = () => {
    if (access.admin && consultores.length > 0) {
      setShowConsultorDialog(true);
    } else {
      navigate("/consultor");
    }
  };

  const handleSelectConsultor = (codigo: string) => {
    setShowConsultorDialog(false);
    navigate(`/consultor?as=${codigo}`);
  };

  const handleResetPreference = () => {
    clearPortalPreference();
    navigate("/portal");
  };

  const hasMultipleAccess = access.admin ||
    access.superAdmin ||
    (access.consultor && access.consultorRecord) ||
    access.instalador ||
    (access.consultor && access.instalador);

  if (isLoading || !hasMultipleAccess) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Alternar Portal</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Alternar Portal</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Portal do Consultor */}
          {(access.admin || access.consultor) && (
            access.admin && consultores.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={currentPortal === "consultor" ? "bg-primary/10" : ""}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Portal do Consultor</span>
                  {currentPortal === "consultor" && (
                    <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel className="text-xs">Selecionar Consultor</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[200px]">
                    {consultores.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => handleSelectConsultor(c.codigo)}
                        className="justify-between"
                      >
                        <span className="truncate font-medium">{c.nome}</span>
                        <span className="ml-2 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.slug || c.codigo}</span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem
                onClick={handleSwitchToConsultor}
                className={currentPortal === "consultor" ? "bg-primary/10" : ""}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Portal do Consultor</span>
                {currentPortal === "consultor" && (
                  <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                )}
              </DropdownMenuItem>
            )
          )}

          {/* Portal do Instalador */}
          {(access.admin || access.instalador) && (
            access.admin && instaladores.length > 1 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={currentPortal === "instalador" ? "bg-primary/10" : ""}>
                  <Wrench className="mr-2 h-4 w-4" />
                  <span>Portal do Instalador</span>
                  {currentPortal === "instalador" && (
                    <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel className="text-xs">Selecionar Instalador</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[200px]">
                    {instaladores.map((i) => (
                      <DropdownMenuItem
                        key={i.id}
                        onClick={() => handleSelectInstalador(i.user_id)}
                      >
                        <span className="truncate">{i.nome}</span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem
                onClick={handleSwitchToInstalador}
                className={currentPortal === "instalador" ? "bg-primary/10" : ""}
              >
                <Wrench className="mr-2 h-4 w-4" />
                <span>Portal do Instalador</span>
                {currentPortal === "instalador" && (
                  <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                )}
              </DropdownMenuItem>
            )
          )}

          {/* Painel Admin */}
          {access.admin && (
            <DropdownMenuItem
              onClick={handleSwitchToAdmin}
              className={currentPortal === "admin" ? "bg-primary/10" : ""}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Painel Admin</span>
              {currentPortal === "admin" && (
                <span className="ml-auto text-xs text-muted-foreground">Atual</span>
              )}
            </DropdownMenuItem>
          )}

          {/* Super Admin */}
          {access.superAdmin && (
            <DropdownMenuItem
              onClick={() => navigate("/super-admin")}
              className={location.pathname === "/super-admin" ? "bg-primary/10" : ""}
            >
              <Building2 className="mr-2 h-4 w-4" />
              <span>Super Admin</span>
              {location.pathname === "/super-admin" && (
                <span className="ml-auto text-xs text-muted-foreground">Atual</span>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleResetPreference} className="text-muted-foreground">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            <span className="text-sm">Redefinir preferência</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog for consultor selection */}
      <Dialog open={showConsultorDialog} onOpenChange={setShowConsultorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Consultor</DialogTitle>
            <DialogDescription>
              Escolha qual consultor você deseja visualizar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {consultores.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => handleSelectConsultor(c.codigo)}
                >
                  <span className="truncate font-medium">{c.nome}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.slug || c.codigo}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog for instalador selection */}
      <Dialog open={showInstaladorDialog} onOpenChange={setShowInstaladorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Instalador</DialogTitle>
            <DialogDescription>
              Escolha qual instalador você deseja visualizar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {instaladores.map((i) => (
                <Button
                  key={i.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleSelectInstalador(i.user_id)}
                >
                  <span className="truncate">{i.nome}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
