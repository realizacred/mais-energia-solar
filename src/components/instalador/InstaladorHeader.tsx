 import { Link } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { LogOut, Eye } from "lucide-react";
 import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
 import logo from "@/assets/logo.png";
 
 interface InstaladorHeaderProps {
   userName?: string;
   onSignOut: () => void;
   isAdminMode?: boolean;
 }
 
 export function InstaladorHeader({ userName, onSignOut, isAdminMode = false }: InstaladorHeaderProps) {
   return (
     <header className="sticky top-0 z-50 border-b bg-background">
       <div className="container mx-auto px-4">
         <div className="flex h-14 items-center justify-between gap-4">
           <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
             <img src={logo} alt="Mais Energia Solar" className="h-9 w-auto" />
             <div className="hidden sm:block border-l border-border pl-3">
               <span className="text-sm font-medium text-muted-foreground">Portal do Instalador</span>
             </div>
           </Link>

           <div className="flex items-center gap-2">
             {isAdminMode && (
               <Badge variant="outline" className="gap-1 text-xs border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                 <Eye className="h-3 w-3" />
                 Visualizando
               </Badge>
             )}
             {userName && (
               <div className="hidden md:block px-3 py-1.5 rounded-lg bg-muted/50">
                 <p className="text-xs text-muted-foreground truncate max-w-[200px]">{userName}</p>
               </div>
             )}
             <PortalSwitcher />
             <Button
               variant="outline"
               size="sm"
               onClick={onSignOut}
               className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
             >
               <LogOut className="h-4 w-4" />
               <span className="hidden sm:inline">Sair</span>
             </Button>
           </div>
         </div>
       </div>
     </header>
   );
 }