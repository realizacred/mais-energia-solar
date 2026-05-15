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
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: {
    id: string;
    numero_cheque: string;
    status: string;
    pagamento_id?: string | null;
  };
}

export function DevolverChequeDialog({ open, onOpenChange, cheque }: Props) {
  const [motivo, setMotivo] = useState("");
  const [novoStatus, setNovoStatus] = useState<"devolvido" | "cancelado">("devolvido");
  const queryClient = useQueryClient();

  const eraCompensado = cheque.status === "compensado";
  const temPagamento = !!cheque.pagamento_id;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cheques")
        .update({
          status: novoStatus,
          motivo_status: motivo.trim(),
        })
        .eq("id", cheque.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cheques"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      toast({
        title: "Cheque atualizado",
        description: eraCompensado && temPagamento
          ? "Pagamento vinculado foi estornado automaticamente."
          : "Status alterado com sucesso.",
      });
      setMotivo("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao processar",
        description: err.message ?? "Falha desconhecida",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!motivo.trim()) {
      toast({ title: "Motivo obrigatório", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver / Cancelar Cheque {cheque.numero_cheque}</DialogTitle>
          <DialogDescription>
            Informe o motivo. Esta ação fica registrada em auditoria.
          </DialogDescription>
        </DialogHeader>

        {eraCompensado && temPagamento && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: pagamento será estornado</AlertTitle>
            <AlertDescription>
              Este cheque já estava <strong>compensado</strong>. Esta ação irá
              estornar automaticamente o pagamento vinculado, recalcular o
              recebimento e voltar a parcela ao status devido.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label>Novo status</Label>
            <Select value={novoStatus} onValueChange={(v: any) => setNovoStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="devolvido">Devolvido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: insuficiência de fundos, sustação, divergência de assinatura…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={mutation.isPending || !motivo.trim()}
          >
            {mutation.isPending ? "Processando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
