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
import { Badge } from "@/components/ui/badge";
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
  const isWon = currentStatus === "won";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {isLost ? "Reativar negociação" : "Remover ganho / Reabrir"}
          </DialogTitle>
          <DialogDescription>
            Status atual: <Badge variant="secondary" className="font-bold">{STATUS_LABEL[currentStatus] ?? currentStatus}</Badge>.
            A negociação voltará para a primeira etapa aberta do funil.
          </DialogDescription>
        </DialogHeader>

        {isWon ? (
          <div className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-bold">Atenção aos impactos operacionais</AlertTitle>
              <AlertDescription className="text-xs space-y-2 mt-2">
                <p>Esta ação reabre apenas a negociação comercial. Itens financeiros e operacionais permanecem ativos e devem ser tratados separadamente:</p>
                <ul className="list-disc pl-4 space-y-1 font-medium opacity-90">
                  <li>CRM será reaberto na etapa inicial</li>
                  <li>Proposta aceita <strong>NÃO</strong> será desfeita</li>
                  <li>Recebimentos <strong>NÃO</strong> serão cancelados automaticamente</li>
                  <li>Comissão <strong>NÃO</strong> será estornada automaticamente</li>
                  <li>Obra/Instalação <strong>NÃO</strong> será cancelada automaticamente</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Histórico preservado</AlertTitle>
            <AlertDescription>
              Pagamentos, recibos, propostas aceitas e logs <strong>não</strong> são apagados.
              A reabertura é registrada em auditoria com seu nome e motivo.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 py-2">
          <Label className="font-bold">Motivo da reabertura *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isWon ? "Ex: cliente desistiu após aceite, erro de marcação..." : "Ex: renegociação solicitada, erro de status..."}
            rows={3}
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground italic">* O motivo será registrado no histórico de auditoria do projeto.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={isWon ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !reason.trim()}
          >
            {mutation.isPending ? "Processando…" : isWon ? "Confirmar remoção de ganho" : "Confirmar reabertura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
