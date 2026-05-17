import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { useLogo } from "@/hooks/useLogo";

interface VendedorHeaderProps {
  vendedorNome: string;
  isAdminMode: boolean;
  isViewingAsVendedor?: boolean;
  onSignOut: () => void;
}

export function VendedorHeader({ vendedorNome, isAdminMode, isViewingAsVendedor, onSignOut }: VendedorHeaderProps) {
  const logo = useLogo({ variant: "small" });
  const displayName = isAdminMode && !isViewingAsVendedor ? "Administrador" : vendedorNome;
  
  return (
    <header className="bg-background/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-50 shadow-sm">
      <div className="px-4 h-16 flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2 rounded-2xl bg-primary/5 border border-primary/10 shadow-inner">
            <img src={logo} alt="Logo" className="h-8 w-auto shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm uppercase tracking-wider text-foreground">
                Consultor<span className="text-primary">Portal</span>
              </h1>
              {isAdminMode && (
                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-primary/10 text-primary border-none font-bold uppercase">
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 font-medium mt-0.5">
              <span className="text-foreground/80">{displayName}</span>
              {isViewingAsVendedor && (
                <span className="text-[10px] text-primary font-bold">(VIEWING)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PortalSwitcher />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSignOut} 
            className="h-9 px-3 gap-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline font-bold text-xs uppercase tracking-wide">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
