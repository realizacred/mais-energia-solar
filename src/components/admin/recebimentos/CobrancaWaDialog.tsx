import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";

interface CobrancaWaDialogProps {
  recebimento: {
    id: string;
    valor_total: number;
    total_pago: number;
    descricao: string | null;
    data_vencimento?: string | null;
    clientes?: { nome: string; telefone: string } | null;
  };
  open: boolean;
  onClose: () => void;
}

function buildMensagem(rec: CobrancaWaDialogProps["recebimento"]): string {
  const nome = rec.clientes?.nome || "Cliente";
  const saldo = Math.max(rec.valor_total - rec.total_pago, 0);

  const lines = [
    `Olá ${nome}! 👋`,
    "",
    "Passando para lembrar sobre seu pagamento:",
    "",
    `💰 Valor total: ${formatBRL(rec.valor_total)}`,
    `✅ Pago: ${formatBRL(rec.total_pago)}`,
    `📋 Saldo: ${formatBRL(saldo)}`,
  ];

  if (rec.data_vencimento) {
    const [y, m, d] = rec.data_vencimento.split("-");
    lines.push(`📅 Vencimento: ${d}/${m}/${y}`);
  }

  lines.push("", "Em caso de dúvidas, fale conosco!");
  if (rec.descricao) {
    lines.push(`_${rec.descricao}_`);
  }

  return lines.join("\n");
}

export function CobrancaWaDialog({ recebimento, open, onClose }: CobrancaWaDialogProps) {
  const [telefone, setTelefone] = useState(recebimento.clientes?.telefone || "");
  const [mensagem, setMensagem] = useState(() => buildMensagem(recebimento));
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!telefone.trim()) {
      toast({ title: "Informe o número do cliente", variant: "destructive" });
      return;
    }
    if (!mensagem.trim()) {
      toast({ title: "Mensagem não pode estar vazia", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-cobranca-wa", {
        body: {
          recebimento_id: recebimento.id,
          telefone: telefone.trim(),
          mensagem: mensagem.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Cobrança enviada por WhatsApp!" });
      onClose();
    } catch (err: any) {
      console.error("[CobrancaWaDialog]", err);
      toast({ title: "Erro ao enviar cobrança", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Send className="w-5 h-5 text-primary" />
            </div>
            Enviar Cobrança via WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número do cliente</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="5531999998888 (com DDI)"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem (editável)</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
