/**
 * VincularClienteDialog — vincula manualmente um lead a um cliente existente
 * do CRM (ex.: cliente migrado do SolarMarket cujo telefone divergiu e por
 * isso não casou automaticamente na vw_orcamentos_comercial).
 *
 * Sem fuzzy automático: usuário escolhe e confirma.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, FolderOpen } from "lucide-react";
import { useSuggestClientesParaLead, useVincularCliente, type ClienteCandidate } from "@/hooks/useVincularCliente";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  leadNome?: string | null;
  onSuccess?: () => void;
}

export function VincularClienteDialog({ open, onOpenChange, leadId, leadNome, onSuccess }: Props) {
  const { data: candidates, isLoading } = useSuggestClientesParaLead(leadId, open);
  const { link } = useVincularCliente();
  const [selected, setSelected] = useState<ClienteCandidate | null>(null);
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    if (!leadId || !selected) return;
    await link.mutateAsync({ leadId, clienteId: selected.cliente_id, reason: reason || undefined });
    onSuccess?.();
    onOpenChange(false);
    setSelected(null);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Vincular a cliente existente
          </DialogTitle>
          <DialogDescription>
            {leadNome ? <>Lead <span className="font-medium text-foreground">{leadNome}</span>. </> : null}
            Selecione o cliente correto. Útil quando o cliente foi migrado (SolarMarket) e o
            telefone/email não casa automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos…
            </div>
          )}

          {!isLoading && (candidates?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum cliente parecido encontrado neste tenant.
            </div>
          )}

          {(candidates ?? []).map((c) => {
            const active = selected?.cliente_id === c.cliente_id;
            return (
              <button
                type="button"
                key={c.cliente_id}
                onClick={() => setSelected(c)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                      {c.telefone_normalized && <span>📞 {c.telefone_normalized}</span>}
                      {c.email && <span>✉️ {c.email}</span>}
                      {(c.cidade || c.estado) && <span>📍 {[c.cidade, c.estado].filter(Boolean).join("/")}</span>}
                    </div>
                    {c.match_reason && (
                      <div className="text-[11px] text-muted-foreground mt-1 italic">{c.match_reason}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {c.external_source === "solarmarket" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                        SM #{c.external_id}
                      </Badge>
                    )}
                    {c.projeto_count > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <FolderOpen className="h-3 w-3" /> {c.projeto_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="reason" className="text-xs">Motivo (opcional, fica auditado)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: telefone divergente após migração SolarMarket"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || link.isPending}>
            {link.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
