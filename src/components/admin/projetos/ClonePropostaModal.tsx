/**
 * ClonePropostaModal.tsx
 * Modal para clonar proposta (mesmo projeto ou outro projeto).
 * §25-S1: Modal padrão com w-[90vw]
 */

import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, AlertTriangle } from "lucide-react";
import { useCloneProposta, useProjetosParaClone } from "@/hooks/useCloneProposta";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClonePropostaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propostaId: string;
  propostaTitulo: string | null;
  dealId: string;
  customerId: string | null;
}

function useProjetoTemPropostaAceita(projetoId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["proposta-aceita-check", projetoId],
    queryFn: async () => {
      if (!projetoId) return false;
      const { data } = await supabase
        .from("propostas_nativas" as any)
        .select("id")
        .eq("projeto_id", projetoId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: enabled && !!projetoId,
  });
}

export function ClonePropostaModal({
  open,
  onOpenChange,
  propostaId,
  propostaTitulo,
  dealId,
  customerId,
}: ClonePropostaModalProps) {
  const [titulo, setTitulo] = useState("");
  const [outroProjeto, setOutroProjeto] = useState(false);
  const [targetDealId, setTargetDealId] = useState("");

  const { mutate: clonar, isPending } = useCloneProposta();
  const { data: projetos, isLoading: loadingProjetos } = useProjetosParaClone(outroProjeto && open);

  const activeTargetId = useMemo(
    () => (outroProjeto ? targetDealId : dealId),
    [outroProjeto, targetDealId, dealId],
  );

  const { data: hasPropostaAceita, isLoading: loadingAceita } = useProjetoTemPropostaAceita(
    activeTargetId,
    open && !!activeTargetId,
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitulo(`${propostaTitulo || "Proposta"} (cópia)`);
      setOutroProjeto(false);
      setTargetDealId("");
    }
  }, [open, propostaTitulo]);

  const handleClonar = () => {
    const target = outroProjeto ? targetDealId : dealId;
    if (!target) return;
    clonar(
      {
        propostaId,
        titulo: titulo.trim() || "Proposta clonada",
        targetDealId: target,
        customerId: outroProjeto ? null : customerId,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const canSubmit = titulo.trim().length > 0 && (!outroProjeto || targetDealId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Copy className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Clonar proposta
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Duplica o dimensionamento para uma nova proposta
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Alerta proposta aceita */}
            {loadingAceita && activeTargetId ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : hasPropostaAceita ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">
                    Este projeto já tem uma proposta aceita
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Criar outra proposta aqui pode gerar confusão com o cliente.
                    Considere clonar para um projeto diferente.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Título */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome da nova proposta</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Proposta residencial (cópia)"
              />
            </div>

            {/* Toggle outro projeto */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Clonar para outro projeto</p>
                <p className="text-xs text-muted-foreground">Duplica a proposta em um projeto diferente</p>
              </div>
              <Switch checked={outroProjeto} onCheckedChange={setOutroProjeto} />
            </div>

            {/* Seletor de projeto */}
            {outroProjeto && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Projeto de destino</Label>
                {loadingProjetos ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando projetos...
                  </div>
                ) : (
                  <Select value={targetDealId} onValueChange={setTargetDealId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {(projetos || [])
                        .filter(pr => pr.id !== dealId)
                        .map(pr => (
                          <SelectItem key={pr.id} value={pr.id}>
                            {pr.nome} {pr.cliente_nome ? `— ${pr.cliente_nome}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs">O que será clonado:</p>
              <p>• Dimensionamento completo (kit, UCs, dados técnicos)</p>
              <p>• Valores e condições comerciais</p>
              <p className="font-medium text-foreground text-xs mt-2">O que NÃO será clonado:</p>
              <p>• PDF/DOCX gerado (precisa re-gerar)</p>
              <p>• Links de envio e tokens de aceite</p>
              <p>• Histórico de envios e visualizações</p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleClonar} disabled={!canSubmit || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Clonar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}