import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isAutoMessageEnabled, setAutoMessageEnabled } from "@/lib/waAutoMessage";

/**
 * Toggle for enabling/disabling automatic WhatsApp welcome messages
 * when creating a new lead. Stored in localStorage per user.
 */
export function WaAutoMessageToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      setEnabled(isAutoMessageEnabled(user.id));
    }
  }, [user]);

  const handleToggle = (checked: boolean) => {
    if (!user) return;
    setEnabled(checked);
    setAutoMessageEnabled(user.id, checked);
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
      <MessageSquare className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <Label htmlFor="wa-auto-msg" className="text-sm font-medium cursor-pointer">
          Mensagem automática ao criar lead
        </Label>
        <p className="text-xs text-muted-foreground">
          Envia uma mensagem profissional de recebimento via WhatsApp
        </p>
      </div>
      <Switch
        id="wa-auto-msg"
        checked={enabled}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
