 import { Button } from "@/components/ui/button";
 import { LogOut } from "lucide-react";
 import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
 import logo from "@/assets/logo.png";
 
interface VendedorHeaderProps {
  vendedorNome: string;
  isAdminMode: boolean;
  isViewingAsVendedor?: boolean;
  onSignOut: () => void;
}

export function VendedorHeader({ vendedorNome, isAdminMode, isViewingAsVendedor, onSignOut }: VendedorHeaderProps) {
  const displayName = isAdminMode && !isViewingAsVendedor ? "Administrador" : vendedorNome;
  
  return (
    <header className="bg-background border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src={logo} alt="Logo" className="h-8 sm:h-10 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-lg truncate">
                Portal do Vendedor
              </h1>
              {isAdminMode && (
                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate flex items-center gap-1">
              <span className="font-medium text-foreground">{displayName}</span>
              {isViewingAsVendedor && (
                <span className="text-[10px] text-muted-foreground">(visualizando)</span>
              )}
            </p>
          </div>
        </div>
         <div className="flex items-center gap-1 sm:gap-2 shrink-0">
           <PortalSwitcher />
           <Button variant="outline" size="sm" onClick={onSignOut} className="gap-1 sm:gap-2">
             <LogOut className="h-4 w-4" />
             <span className="hidden sm:inline">Sair</span>
           </Button>
         </div>
       </div>
     </header>
   );
 }