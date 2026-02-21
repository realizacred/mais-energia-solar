import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function NotificationsDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground rounded-md">
          <Bell className="h-4 w-4 text-warning" />
          {/* Ping indicator */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-ping" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-semibold">Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
