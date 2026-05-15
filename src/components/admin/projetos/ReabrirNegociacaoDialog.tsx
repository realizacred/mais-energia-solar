import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  currentStatus: "won" | "lost" | "canceled" | string;
  onReopened?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  won: "Ganho",
  lost: "Perdido",
  canceled: "Cancelado",
};

export function ReabrirNegociacaoDialog({
  open, onOpenChange, dealId, currentStatus, onReopened,
}: Props) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_reopen_deal" as any, {
        p_deal_id: dealId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projeto-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-pipeline"] });
      const hasPayments = data?.has_payments;
      toast({
        title: "Negociação reaberta",
        description: hasPayments
          ? `Movida para "${data?.new_stage_name}". Pagamentos preservados.`
          : `Movida para "${data?.new_stage_name}".`,
      });
      setReason("");
      onReopened?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao reabrir",
        description: err.message ?? "Falha desconhecida",
        variant: "destructive",
      });
    },
  });

  const isLost = currentStatus === "lost" || currentStatus === "canceled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {isLost ? "Reativar negociação" : "Remover ganho / Reabrir"}
          </DialogTitle>
          <DialogDescription>
            Status atual: <strong>{STATUS_LABEL[currentStatus] ?? currentStatus}</strong>.
            A negociação voltará para a primeira etapa aberta do funil.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Histórico preservado</AlertTitle>
          <AlertDescription>
            Pagamentos, recibos, propostas aceitas e logs <strong>não</strong> são apagados.
            A reabertura é registrada em auditoria com seu nome e motivo.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Motivo *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: cliente desistiu após aceite, erro de marcação, renegociação solicitada…"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !reason.trim()}
          >
            {mutation.isPending ? "Reabrindo…" : "Confirmar reabertura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
