import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, MapPin, Truck, Pencil } from "lucide-react";
import { useFornecedoresNomes } from "@/hooks/useFornecedoresNomes";
import { useCriarOrdem, useAtualizarOrdem } from "@/hooks/useOrdensCompra";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ExistingOrdem {
  id: string;
  fornecedor_id?: string | null;
  numero_pedido?: string | null;
  valor_total?: number | null;
  data_pedido?: string | null;
  data_previsao_entrega?: string | null;
  observacoes?: string | null;
}

interface VincularFornecedorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoCodigo?: string;
  clienteNome?: string;
  onSuccess: () => void;
  onCancel: () => void;
  /** Quando informado, modal entra em modo edição (UPDATE) sobre a ordem existente. */
  ordemExistente?: ExistingOrdem | null;
}

export function VincularFornecedorModal({
  open,
  onOpenChange,
  projetoId,
  projetoCodigo,
  clienteNome,
  onSuccess,
  onCancel,
  ordemExistente,
}: VincularFornecedorModalProps) {
  const { data: fornecedores = [] } = useFornecedoresNomes();
  const criarOrdem = useCriarOrdem();
  const atualizarOrdem = useAtualizarOrdem();

  const isEdit = !!ordemExistente?.id;

  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [dataPedido, setDataPedido] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const resetForm = () => {
    setFornecedorId("");
    setNumeroPedido("");
    setValorTotal(0);
    setDataPedido("");
    setDataPrevisao("");
    setObservacoes("");
  };

  // Hidrata o formulário quando entra em modo edição
  useEffect(() => {
    if (open && ordemExistente) {
      setFornecedorId(ordemExistente.fornecedor_id || "");
      setNumeroPedido(ordemExistente.numero_pedido || "");
      setValorTotal(Number(ordemExistente.valor_total || 0));
      setDataPedido(ordemExistente.data_pedido || "");
      setDataPrevisao(ordemExistente.data_previsao_entrega || "");
      setObservacoes(ordemExistente.observacoes || "");
    } else if (open && !ordemExistente) {
      resetForm();
    }
  }, [open, ordemExistente]);

  const handleConfirm = async () => {
    if (!fornecedorId) {
      toast({ title: "Selecione um fornecedor", variant: "destructive" });
      return;
    }
    if (!numeroPedido.trim()) {
      toast({ title: "Informe o número do pedido", variant: "destructive" });
      return;
    }
    if (!valorTotal || valorTotal <= 0) {
      toast({ title: "Informe o valor do pedido", variant: "destructive" });
      return;
    }

    if (!projetoId || projetoId === "") {
      toast({
        title: "Erro de Contexto",
        description: "ID do projeto não identificado. Tente atualizar a página.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEdit && ordemExistente) {
        await atualizarOrdem.mutateAsync({
          id: ordemExistente.id,
          fornecedor_id: fornecedorId,
          numero_pedido: numeroPedido,
          data_pedido: dataPedido || null,
          data_previsao_entrega: dataPrevisao || null,
          observacoes: observacoes || null,
          valor_total: valorTotal,
        });
        toast({ title: "Pedido atualizado!" });
      } else {
        await criarOrdem.mutateAsync({
          projeto_id: projetoId,
          fornecedor_id: fornecedorId,
          numero_pedido: numeroPedido,
          data_pedido: dataPedido || undefined,
          data_previsao_entrega: dataPrevisao || undefined,
          observacoes: observacoes || undefined,
          itens: [{
            descricao: "Kit Solar / Equipamentos",
            quantidade: 1,
            valor_unitario: valorTotal,
          }],
        });

        const fornecedorNome = fornecedores.find((f) => f.id === fornecedorId)?.nome;
        await (supabase as any).from("projetos_historico").insert({
          projeto_id: projetoId,
          acao: "fornecedor_vinculado",
          descricao: `Fornecedor ${fornecedorNome} vinculado — Pedido ${numeroPedido}`,
        });
        toast({ title: "Fornecedor vinculado e etapa avançada!" });
      }

      window.dispatchEvent(new CustomEvent("ordem-compra-criada"));
      onSuccess();
      onOpenChange(false);
      if (!isEdit) resetForm();
    } catch (err: any) {
      toast({
        title: isEdit ? "Erro ao atualizar pedido" : "Erro ao vincular fornecedor",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const pending = criarOrdem.isPending || atualizarOrdem.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {isEdit ? <Pencil className="w-5 h-5 text-primary" /> : <Package className="w-6 h-6 text-primary" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEdit ? "Editar Pedido / Fornecedor" : "Vincular Fornecedor ao Pedido"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Projeto: <span className="font-semibold text-foreground">{projetoCodigo || clienteNome || "NÃO IDENTIFICADO"}</span>
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
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button variant="link" size="sm" className="h-auto p-0 text-[11px] gap-1" asChild>
                <a href="/admin/fornecedores" target="_blank" rel="noopener noreferrer">
                  <Plus className="h-3 w-3" /> Gerenciar Fornecedores
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_pedido" className="flex items-center gap-1">
                Nº do Pedido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="numero_pedido"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
                placeholder="Ex: PED-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor" className="flex items-center gap-1">
                Valor do Pedido <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput value={valorTotal} onChange={setValorTotal} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_pedido">Data do Pedido</Label>
              <DateInput value={dataPedido} onChange={setDataPedido} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previsao">Previsão de Entrega</Label>
              <DateInput value={dataPrevisao} onChange={setDataPrevisao} />
            </div>
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

          {!isEdit && (
            <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-amber-800 dark:text-amber-400">
              <Truck className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <strong>Atenção:</strong> Vincular um fornecedor é obrigatório para mover o projeto para a etapa de <strong>Pedido Efetuado</strong>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/30 flex items-center sm:justify-between gap-3">
          <Button variant="ghost" onClick={() => { onCancel(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!fornecedorId || pending}>
            {pending ? "Processando..." : isEdit ? "Salvar alterações" : "Confirmar e Avançar →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
