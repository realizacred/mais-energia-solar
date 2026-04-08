/**
 * GrupoKitsModal
 * Modal para criar/gerenciar links de kits de propostas.
 * Página pública — exceção RB-02 documentada.
 * RB-03, RB-07, RB-17
 */

import { useState } from "react";
import { Link2, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useCreateGrupoKit, useGruposKitByProjeto } from "@/hooks/usePropostaGrupoToken";
import { formatBRL } from "@/lib/formatters";
import { QRCodeCanvas } from "qrcode.react";

interface Proposta {
  id: string;
  titulo: string;
  nome_kit: string | null;
  status: string;
  versoes?: Array<{
    valor_total: number;
    potencia_kwp: number;
  }>;
}

interface GrupoKitsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  propostas: Proposta[];
}

export function GrupoKitsModal({ open, onOpenChange, projetoId, propostas }: GrupoKitsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState("Escolha seu Kit Solar");
  const [expiresDays, setExpiresDays] = useState(30);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateGrupoKit();
  const { data: existingGrupos = [] } = useGruposKitByProjeto(projetoId);

  const validPropostas = propostas.filter(p =>
    ["rascunho", "gerada", "enviada", "vista", "aceita", "aprovada"].includes(p.status)
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size < 2) {
      toast({ title: "Selecione pelo menos 2 propostas", variant: "destructive" });
      return;
    }
    const result = await createMutation.mutateAsync({
      projeto_id: projetoId,
      proposta_ids: Array.from(selectedIds),
      titulo,
      expires_days: expiresDays,
    });
    setGeneratedUrl(result.url);
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setGeneratedUrl(null);
    setSelectedIds(new Set());
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Link de Kits</DialogTitle>
              <DialogDescription>
                Agrupe propostas como opções para o cliente escolher
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!generatedUrl ? (
          <div className="space-y-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="titulo-grupo">Título do grupo</Label>
              <Input
                id="titulo-grupo"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Escolha seu Kit Solar"
              />
            </div>

            {/* Validade */}
            <div className="space-y-2">
              <Label htmlFor="expires-days">Validade (dias)</Label>
              <Input
                id="expires-days"
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={e => setExpiresDays(Number(e.target.value))}
              />
            </div>

            {/* Propostas */}
            <div className="space-y-2">
              <Label>Selecione as propostas (mínimo 2)</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {validPropostas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma proposta disponível
                  </p>
                ) : (
                  validPropostas.map(p => {
                    const v = p.versoes?.[0];
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelection(p.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.nome_kit || p.titulo || `Proposta`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {v && (
                              <>
                                <span className="text-xs text-muted-foreground">
                                  {formatBRL(v.valor_total)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {v.potencia_kwp?.toFixed(1)} kWp
                                </span>
                              </>
                            )}
                            <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Link gerado */}
            <div className="space-y-2">
              <Label>Link gerado</Label>
              <div className="flex gap-2">
                <Input value={generatedUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(generatedUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeCanvas value={generatedUrl} size={180} />
            </div>
          </div>
        )}

        {/* Existing grupos */}
        {existingGrupos.length > 0 && !generatedUrl && (
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-xs text-muted-foreground">Links anteriores</Label>
            {existingGrupos.map(g => (
              <div key={g.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate text-foreground">{g.titulo}</span>
                <span className="text-muted-foreground shrink-0">{g.proposta_ids.length} kits</span>
                <span className="text-muted-foreground shrink-0">{g.view_count} views</span>
                {g.kit_aceito_id && (
                  <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20">Aceito</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={() => {
                    const appUrl = import.meta.env.VITE_PUBLIC_URL || "https://maisenergiasolar.lovable.app";
                    navigator.clipboard.writeText(`${appUrl}/kits/${g.token}`);
                    toast({ title: "Link copiado!" });
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {!generatedUrl ? (
            <Button
              onClick={handleCreate}
              disabled={selectedIds.size < 2 || createMutation.isPending}
            >
              {createMutation.isPending ? "Gerando..." : "Gerar Link"}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleReset}>
              Criar outro link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
