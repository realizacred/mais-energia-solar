import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Search, MapPin, Truck } from "lucide-react";
import { useFornecedoresNomes } from "@/hooks/useFornecedoresNomes";
import { useCriarOrdem } from "@/hooks/useOrdensCompra";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface VincularFornecedorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  clienteNome?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VincularFornecedorModal({
  open,
  onOpenChange,
  projetoId,
  clienteNome,
  onSuccess,
  onCancel
}: VincularFornecedorModalProps) {
  const { data: fornecedores = [], isLoading: loadingFornecedores } = useFornecedoresNomes();
  const criarOrdem = useCriarOrdem();

  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const resetForm = () => {
    setFornecedorId("");
    setNumeroPedido("");
    setValorTotal(0);
    setDataPrevisao("");
    setObservacoes("");
  };

  const handleConfirm = async () => {
    if (!fornecedorId) {
      toast({ title: "Selecione um fornecedor", variant: "destructive" });
      return;
    }

    try {
      // 1. Criar Ordem de Compra
      await criarOrdem.mutateAsync({
        projeto_id: projetoId,
        fornecedor_id: fornecedorId,
        numero_pedido: numeroPedido || undefined,
        valor_total: valorTotal,
        data_previsao_entrega: dataPrevisao || undefined,
        observacoes: observacoes || undefined,
      });

      // 2. Gravar histórico do projeto (evento manual via supabase)
      const fornecedorNome = fornecedores.find(f => f.id === fornecedorId)?.nome;
      await (supabase as any).from("projetos_historico").insert({
        projeto_id: projetoId,
        acao: "fornecedor_vinculado",
        descricao: `Fornecedor ${fornecedorNome} vinculado — Pedido ${numeroPedido || 'N/A'}`,
      });

      toast({ title: "Fornecedor vinculado e etapa avançada!" });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro ao vincular fornecedor", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Vincular Fornecedor ao Pedido</DialogTitle>
              <DialogDescription className="text-sm">
                Projeto: <span className="font-semibold text-foreground">{clienteNome || "NÃO IDENTIFICADO"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="fornecedor" className="flex items-center gap-1">
              Fornecedor <span className="text-destructive">*</span>
            </Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger id="fornecedor">
                <SelectValue placeholder="Buscar fornecedor..." />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{f.nome}</span>
                        {f.tipo && (
                          <Badge variant="outline" className="text-[9px] uppercase px-1 h-3.5">
                            {f.tipo}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {f.cidade || "Cidade não informada"}
                      </div>
                    </div>
                  </SelectItem>
                ))}
                <div className="p-2 border-t border-border mt-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-primary" asChild>
                    <a href="/admin/fornecedores" target="_blank" rel="noopener noreferrer">
                      <Plus className="h-3.5 w-3.5" /> Adicionar Novo Fornecedor
                    </a>
                  </Button>
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_pedido">Nº do Pedido (opcional)</Label>
              <Input 
                id="numero_pedido" 
                value={numeroPedido} 
                onChange={(e) => setNumeroPedido(e.target.value)}
                placeholder="Ex: PED-2026-001" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor do Pedido</Label>
              <CurrencyInput value={valorTotal} onChange={setValorTotal} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="previsao">Previsão de Entrega</Label>
            <DateInput value={dataPrevisao} onChange={setDataPrevisao} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea 
              id="obs" 
              value={observacoes} 
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3} 
            />
          </div>

          <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-amber-800 dark:text-amber-400">
            <Truck className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <strong>Atenção:</strong> Vincular um fornecedor é obrigatório para mover o projeto para a etapa de <strong>Pedido Efetuado</strong>.
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/30 flex items-center sm:justify-between gap-3">
          <Button variant="ghost" onClick={() => { onCancel(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!fornecedorId || criarOrdem.isPending}>
            {criarOrdem.isPending ? "Processando..." : "Confirmar e Avançar →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
