/**
 * Dialog de envio manual de follow-up de proposta (Phase 2).
 *
 * Reutiliza shadcn Dialog. Mensagem editável com sugestão padrão.
 * Mostra guardrails (cliente, canal, tentativa nº) antes do envio.
 * Não duplica lógica: validação pesada é no edge function proposal-followup-send.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Send, Loader2, Phone } from "lucide-react";
import { useSendProposalFollowup } from "@/hooks/useFollowupComercial";
import type { FollowupInboxRow } from "@/hooks/useFollowupComercial";

interface Props {
  row: FollowupInboxRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function defaultMessage(row: FollowupInboxRow): string {
  const nome = (row.cliente_nome ?? "").split(" ")[0] || "tudo bem";
  const titulo = row.titulo ? ` sobre a proposta "${row.titulo}"` : "";
  return (
    `Olá, ${nome}! Tudo bem?\n\n` +
    `Passando para retomar nosso contato${titulo}. ` +
    `Posso esclarecer alguma dúvida ou ajustar algum ponto para seguirmos?\n\n` +
    `Aguardo seu retorno. Obrigado!`
  );
}

function formatPhone(p: string | null) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return p;
}

export function FollowupSendDialog({ row, open, onOpenChange }: Props) {
  const [message, setMessage] = useState("");
  const [force, setForce] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const send = useSendProposalFollowup();

  useEffect(() => {
    if (row && open) {
      setMessage(defaultMessage(row));
      setForce(false);
      setForceReason("");
    }
  }, [row, open]);

  const charCount = message.length;
  const tooShort = charCount < 5;
  const tooLong = charCount > 2000;
  const attemptNumber = useMemo(() => (row?.qtd_followups ?? 0) + 1, [row]);

  if (!row) return null;

  const handleSend = async () => {
    try {
      await send.mutateAsync({
        proposta_id: row.proposta_id,
        versao_id: row.versao_id,
        message: message.trim(),
        force,
        force_reason: force ? forceReason.trim() : undefined,
      });
      onOpenChange(false);
    } catch {
      // toast já tratado no hook; permite override quando aplicável
    }
  };

  const lastError = send.error;
  const isOverridable =
    lastError &&
    ["cooldown_active", "daily_cap_reached", "max_attempts_reached"].includes(lastError.code);
  const forceReasonInvalid = force && forceReason.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar follow-up via WhatsApp</DialogTitle>
          <DialogDescription>
            Mensagem manual com guardrails de cooldown, opt-out e limite diário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 bg-muted/30 text-sm space-y-1">
            <div className="font-medium text-foreground truncate">
              {row.cliente_nome ?? "Cliente sem nome"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {formatPhone(row.telefone_normalized)}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">
                Tentativa #{attemptNumber}
              </Badge>
              {row.dias_parado != null && (
                <Badge variant="outline" className="text-[10px]">
                  {row.dias_parado}d parado
                </Badge>
              )}
              {row.titulo && (
                <Badge variant="outline" className="text-[10px] truncate max-w-[180px]">
                  {row.codigo ? `${row.codigo} · ` : ""}{row.titulo}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Mensagem</label>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem…"
              className="text-sm"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Tom claro, curto, com call-to-action.</span>
              <span className={tooLong ? "text-destructive" : ""}>{charCount}/2000</span>
            </div>
          </div>

          {lastError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1 min-w-0">
                <div className="font-medium">{lastError.message}</div>
                {isOverridable && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[11px] text-foreground/80">
                      <input
                        type="checkbox"
                        checked={force}
                        onChange={(e) => setForce(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      Forçar envio mesmo assim (registrado em auditoria)
                    </label>
                    {force && (
                      <Textarea
                        rows={2}
                        value={forceReason}
                        onChange={(e) => setForceReason(e.target.value)}
                        placeholder="Justificativa (mín. 5 caracteres) — obrigatória para auditoria."
                        className="text-xs text-foreground"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={send.isPending || tooShort || tooLong}
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
