import { LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ProfileDropdownProps {
  userEmail?: string;
  onSignOut: () => void;
}

export function ProfileDropdown({ userEmail, onSignOut }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const initials = userEmail
    ? userEmail.substring(0, 2).toUpperCase()
    : "US";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/admin/tenant-settings")} className="text-xs gap-2">
          <Settings className="h-3.5 w-3.5" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/admin/usuarios")} className="text-xs gap-2">
          <User className="h-3.5 w-3.5" />
          Usuários
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-xs gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
