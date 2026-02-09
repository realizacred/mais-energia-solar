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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Limite do plano atingido</DialogTitle>
          <DialogDescription className="text-center">
            Você atingiu o limite de <strong>{label}</strong> do seu plano atual.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <div className="text-3xl font-bold text-foreground">
            {currentValue} <span className="text-muted-foreground text-lg font-normal">/ {limitValue}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button className="w-full gap-2" disabled>
            <Sparkles className="h-4 w-4" />
            Fazer upgrade do plano
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
