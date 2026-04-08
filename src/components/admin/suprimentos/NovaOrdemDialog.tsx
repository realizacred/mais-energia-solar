import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Plus, Trash2, Package, ArrowRight, ArrowLeft } from "lucide-react";
import { useCriarOrdem } from "@/hooks/useOrdensCompra";
import { useProjetosSelect } from "@/hooks/useOrdensCompra";
import { useFornecedoresNomes } from "@/hooks/useFornecedoresNomes";
import { useEstoqueItens } from "@/hooks/useEstoque";
import { toast } from "@/hooks/use-toast";

interface NovaOrdemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjetoId?: string;
}

interface ItemDraft {
  estoque_item_id?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
}

export function NovaOrdemDialog({ open, onOpenChange, defaultProjetoId }: NovaOrdemDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [projetoId, setProjetoId] = useState(defaultProjetoId || "");
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().split("T")[0]);
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemDraft[]>([]);

  // New item form
  const [novoItemDesc, setNovoItemDesc] = useState("");
  const [novoItemQtd, setNovoItemQtd] = useState(1);
  const [novoItemUnidade, setNovoItemUnidade] = useState("un");
  const [novoItemValor, setNovoItemValor] = useState(0);
  const [novoItemEstoqueId, setNovoItemEstoqueId] = useState("");

  const { data: projetos = [] } = useProjetosSelect();
  const { data: fornecedores = [] } = useFornecedoresNomes();
  const { data: estoqueItens = [] } = useEstoqueItens();
  const criarOrdem = useCriarOrdem();

  const resetForm = () => {
    setStep(1);
    setProjetoId(defaultProjetoId || "");
    setFornecedorId("");
    setNumeroPedido("");
    setDataPedido(new Date().toISOString().split("T")[0]);
    setDataPrevisao("");
    setObservacoes("");
    setItens([]);
    resetNovoItem();
  };

  const resetNovoItem = () => {
    setNovoItemDesc("");
    setNovoItemQtd(1);
    setNovoItemUnidade("un");
    setNovoItemValor(0);
    setNovoItemEstoqueId("");
  };

  const addItem = () => {
    if (!novoItemDesc.trim()) return;
    setItens(prev => [...prev, {
      estoque_item_id: novoItemEstoqueId || undefined,
      descricao: novoItemDesc,
      quantidade: novoItemQtd,
      unidade: novoItemUnidade,
      valor_unitario: novoItemValor,
    }]);
    resetNovoItem();
  };

  const removeItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const selectEstoqueItem = (itemId: string) => {
    const item = estoqueItens.find((i: any) => i.id === itemId);
    if (item) {
      setNovoItemEstoqueId(itemId);
      setNovoItemDesc((item as any).nome || "");
      setNovoItemUnidade((item as any).unidade || "un");
    }
  };

  const totalOrdem = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  const handleSubmit = async () => {
    try {
      const ordem = await criarOrdem.mutateAsync({
        projeto_id: projetoId || undefined,
        fornecedor_id: fornecedorId || undefined,
        numero_pedido: numeroPedido || undefined,
        data_pedido: dataPedido || undefined,
        data_previsao_entrega: dataPrevisao || undefined,
        observacoes: observacoes || undefined,
        itens: itens.map(i => ({
          estoque_item_id: i.estoque_item_id,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valor_unitario: i.valor_unitario,
        })),
      });
      toast({ title: "Ordem criada com sucesso" });
      resetForm();
      onOpenChange(false);
      navigate(`/admin/suprimentos/${ordem.id}`);
    } catch (err: any) {
      toast({ title: "Erro ao criar ordem", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Nova Ordem de Compra
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Passo {step} de 2 — {step === 1 ? "Dados gerais" : "Adicionar itens"}
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] flex-1 min-h-0">
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={projetoId} onValueChange={setProjetoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {projetos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.codigo || p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nº do pedido</Label>
                <Input value={numeroPedido} onChange={e => setNumeroPedido(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Data do pedido</Label>
                <DateInput value={dataPedido} onChange={setDataPedido} />
              </div>
              <div className="space-y-2">
                <Label>Previsão de entrega</Label>
                <DateInput value={dataPrevisao} onChange={setDataPrevisao} />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Opcional" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Add item form */}
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-semibold text-foreground">Adicionar item</p>
                <div className="space-y-2">
                  <Label className="text-xs">Buscar no catálogo (opcional)</Label>
                  <Select value={novoItemEstoqueId} onValueChange={selectEstoqueItem}>
                    <SelectTrigger><SelectValue placeholder="Selecionar do estoque..." /></SelectTrigger>
                    <SelectContent>
                      {(estoqueItens as any[]).map((i: any) => (
                        <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={novoItemDesc} onChange={e => setNovoItemDesc(e.target.value)} placeholder="Nome do item" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" min={1} value={novoItemQtd} onChange={e => setNovoItemQtd(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Unidade</Label>
                    <Input value={novoItemUnidade} onChange={e => setNovoItemUnidade(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor unitário</Label>
                    <CurrencyInput value={novoItemValor} onChange={setNovoItemValor} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addItem} disabled={!novoItemDesc.trim()} variant="outline" className="w-full gap-1.5">
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Items list */}
              {itens.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-foreground">Descrição</th>
                        <th className="text-center px-3 py-2 font-semibold text-foreground">Qtd</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground">Vlr unit.</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-3 py-2 text-foreground">{item.descricao}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{item.quantidade} {item.unidade}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">{formatBRL(item.valor_unitario)}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">{formatBRL(item.quantidade * item.valor_unitario)}</td>
                          <td className="px-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground">Total:</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-foreground">{formatBRL(totalOrdem)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {itens.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Nenhum item adicionado ainda
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/30">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
              <Button onClick={() => setStep(2)} className="gap-1.5">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={criarOrdem.isPending} className="gap-1.5">
                {criarOrdem.isPending ? "Criando..." : "Criar ordem"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
