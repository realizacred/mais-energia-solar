import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeftRight, Users, Settings, Wrench, ChevronRight } from "lucide-react";
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

interface PortalAccess {
  vendedor: boolean;
  admin: boolean;
  instalador: boolean;
  vendedorRecord: boolean;
}

interface Vendedor {
  id: string;
  nome: string;
  codigo: string;
}

interface Instalador {
  id: string;
  nome: string;
  user_id: string;
}

export function PortalSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [access, setAccess] = useState<PortalAccess>({ 
    vendedor: false, 
    admin: false, 
    instalador: false,
    vendedorRecord: false 
  });
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [showVendedorDialog, setShowVendedorDialog] = useState(false);
  const [showInstaladorDialog, setShowInstaladorDialog] = useState(false);

  const currentPortal = location.pathname.startsWith("/vendedor") 
    ? "vendedor" 
    : location.pathname.startsWith("/instalador") || location.pathname.startsWith("/checklist")
    ? "instalador"
    : "admin";

  useEffect(() => {
    if (user) {
      checkAccess();
    }
  }, [user]);

  const checkAccess = async () => {
    if (!user) return;

    try {
      const { data: roles } = await supabase
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

      // If admin, load all vendedores and instaladores for selection
      if (isAdmin) {
        const [vendedoresRes, instaladoresRes] = await Promise.all([
          supabase
            .from("vendedores")
            .select("id, nome, codigo")
            .eq("ativo", true)
            .order("nome"),
          supabase
            .from("profiles")
            .select("id, nome, user_id")
            .eq("ativo", true)
            .in("user_id", 
              (await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "instalador")
              ).data?.map(r => r.user_id) || []
            )
            .order("nome")
        ]);
        setVendedores(vendedoresRes.data || []);
        setInstaladores(instaladoresRes.data || []);
      }

      setAccess({
        vendedor: isVendedor || false,
        admin: isAdmin || false,
        instalador: isInstalador || false,
        vendedorRecord: hasVendedorRecord,
      });
    } catch (error) {
      console.error("Error checking access:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToAdmin = () => {
    navigate("/admin");
  };

  const handleSwitchToInstalador = () => {
    // If admin and multiple installers, show selection
    if (access.admin && !access.instalador && instaladores.length > 1) {
      setShowInstaladorDialog(true);
    } else if (access.admin && instaladores.length === 1) {
      // Only one installer, go directly
      navigate(`/instalador?as=${instaladores[0].user_id}`);
    } else {
      // User is an instalador, go to their portal
      navigate("/instalador");
    }
  };

  const handleSelectInstalador = (userId: string) => {
    setShowInstaladorDialog(false);
    navigate(`/instalador?as=${userId}`);
  };

  const handleSwitchToVendedor = () => {
    // If user is admin and not a vendedor themselves, show selection dialog
    if (access.admin && !access.vendedorRecord && vendedores.length > 0) {
      setShowVendedorDialog(true);
    } else {
      // User is a vendedor, go to their portal
      navigate("/vendedor");
    }
  };

  const handleSelectVendedor = (codigo: string) => {
    setShowVendedorDialog(false);
    // Navigate to vendor portal with admin mode (viewing as specific vendor)
    navigate(`/vendedor?as=${codigo}`);
  };

  const handleResetPreference = () => {
    clearPortalPreference();
    navigate("/portal");
  };

  // Show if admin (can access all portals) or has multiple roles
  const hasMultipleAccess = access.admin || 
    (access.vendedor && access.vendedorRecord) || 
    access.instalador ||
    (access.vendedor && access.instalador);
  
  if (loading || !hasMultipleAccess) {
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
          
          {/* Portal do Vendedor */}
          {(access.admin || access.vendedor) && (
            access.admin && vendedores.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={currentPortal === "vendedor" ? "bg-primary/10" : ""}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Portal do Vendedor</span>
                  {currentPortal === "vendedor" && (
                    <span className="ml-auto text-xs text-muted-foreground">Atual</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel className="text-xs">Selecionar Vendedor</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[200px]">
                    {vendedores.map((v) => (
                      <DropdownMenuItem 
                        key={v.id}
                        onClick={() => handleSelectVendedor(v.codigo)}
                      >
                        <span className="truncate">{v.nome}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{v.codigo}</span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem 
                onClick={handleSwitchToVendedor}
                className={currentPortal === "vendedor" ? "bg-primary/10" : ""}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Portal do Vendedor</span>
                {currentPortal === "vendedor" && (
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

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleResetPreference} className="text-muted-foreground">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            <span className="text-sm">Redefinir preferência</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog for vendedor selection (fallback for mobile) */}
      <Dialog open={showVendedorDialog} onOpenChange={setShowVendedorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Vendedor</DialogTitle>
            <DialogDescription>
              Escolha qual vendedor você deseja visualizar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {vendedores.map((v) => (
                <Button
                  key={v.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => handleSelectVendedor(v.codigo)}
                >
                  <span className="truncate">{v.nome}</span>
                  <span className="text-xs text-muted-foreground">{v.codigo}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog for instalador selection (fallback for mobile) */}
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
