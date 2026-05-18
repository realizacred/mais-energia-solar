import { MessageCircle, MessageCirclePlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaInboxHeaderProps {
  instances: { id: string; status: string }[];
  onNewChat: () => void;
  onSettings: () => void;
  compact?: boolean;
}

export function WaInboxHeader({ instances, onNewChat, onSettings, compact = false }: WaInboxHeaderProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-bold text-foreground leading-tight truncate">Central WhatsApp</h2>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${instances.some(i => i.status === "connected") ? "bg-success animate-pulse" : "bg-destructive"}`} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {instances.filter(i => i.status === "connected").length}/{instances.length} online
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Central de Atendimento</h2>
          <p className="text-sm text-muted-foreground">
            {instances.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${instances.some(i => i.status === "connected") ? "bg-success animate-pulse" : "bg-destructive"}`} />
                {instances.filter(i => i.status === "connected").length}/{instances.length} instâncias online
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onNewChat}
          title="Iniciar nova conversa"
        >
          <MessageCirclePlus className="h-4 w-4 mr-1" />
          Nova conversa
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onSettings}
          title="Configurações WhatsApp"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}