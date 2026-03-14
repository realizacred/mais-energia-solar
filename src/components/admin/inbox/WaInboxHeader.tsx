import { MessageCircle, MessageCirclePlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaInboxHeaderProps {
  instances: { id: string; status: string }[];
  onNewChat: () => void;
  onSettings: () => void;
}

export function WaInboxHeader({ instances, onNewChat, onSettings }: WaInboxHeaderProps) {
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
