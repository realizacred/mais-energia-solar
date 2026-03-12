import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";

const METRIC_LABELS: Record<string, string> = {
  max_users: "Usuários",
  max_leads_month: "Leads por mês",
  max_wa_messages_month: "Mensagens WhatsApp por mês",
  max_automations: "Automações",
  max_storage_mb: "Armazenamento (MB)",
  max_proposals_month: "Propostas por mês",
};

interface LimitReachedDialogProps {
  open: boolean;
  onClose: () => void;
  metricKey: string;
  currentValue: number;
  limitValue: number;
}

export function LimitReachedDialog({
  open,
  onClose,
  metricKey,
  currentValue,
  limitValue,
}: LimitReachedDialogProps) {
  const label = METRIC_LABELS[metricKey] || metricKey;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Limite do plano atingido</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você atingiu o limite de <strong>{label}</strong> do seu plano atual.
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <div className="text-3xl font-bold text-foreground">
              {currentValue} <span className="text-muted-foreground text-lg font-normal">/ {limitValue}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4 border-t border-border bg-muted/30">
          <Button className="w-full gap-2" disabled>
            <Sparkles className="h-4 w-4" />
            Fazer upgrade do plano
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
