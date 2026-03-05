import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import {
  useCreateEstoqueItem, useCreateMovimento, useEstoqueLocais,
  ESTOQUE_CATEGORIAS, ESTOQUE_UNIDADES, CATEGORIA_LABELS,
} from "@/hooks/useEstoque";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultSku?: string;
}

export function ItemFormDialog({ open, onOpenChange, defaultSku = "" }: ItemFormDialogProps) {
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [unidade, setUnidade] = useState("UN");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [fornecedor, setFornecedor] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [qtdInicial, setQtdInicial] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [localId, setLocalId] = useState("");

  useEffect(() => { if (open && defaultSku) { setSku(defaultSku); setCodigoBarras(defaultSku); } }, [open, defaultSku]);

  const createItem = useCreateEstoqueItem();
  const createMovimento = useCreateMovimento();
  const { data: locais } = useEstoqueLocais();

  const resetForm = () => {
    setNome(""); setSku(""); setCategoria("geral"); setUnidade("UN");
    setEstoqueMinimo("0"); setFornecedor(""); setCodigoBarras("");
    setQtdInicial(""); setCustoUnitario(""); setLocalId("");
  };

  const handleSubmit = () => {
    if (!nome.trim()) return;
    createItem.mutate(
      {
        nome: nome.trim(),
        sku: sku.trim() || null,
        categoria,
        unidade,
        estoque_minimo: Number(estoqueMinimo) || 0,
        ativo: true,
        descricao: null,
        fornecedor: fornecedor.trim() || null,
        codigo_barras: codigoBarras.trim() || null,
      } as any,
      {
        onSuccess: (createdItem: any) => {
          const qty = Number(qtdInicial);
          if (qty > 0) {
            createMovimento.mutate({
              item_id: createdItem.id,
              local_id: localId || null,
              tipo: "entrada",
              quantidade: qty,
              custo_unitario: Number(custoUnitario) || null,
              origem: "manual",
              observacao: "Entrada inicial no cadastro",
            });
          }
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const isSaving = createItem.isPending || createMovimento.isPending;

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Novo Item de Estoque"
      onSubmit={handleSubmit} submitLabel="Cadastrar" saving={isSaving}
      disabled={!nome.trim()} asForm
    >
      <FormGrid>
        <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cabo solar 6mm²" /></div>
        <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Código interno" /></div>
      </FormGrid>
      <FormGrid>
        <div>
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTOQUE_CATEGORIAS.map((c) => (<SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unidade</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTOQUE_UNIDADES.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </FormGrid>
      <FormGrid>
        <div><Label>Código de barras</Label><Input value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} placeholder="EAN/UPC" /></div>
        <div><Label>Fornecedor</Label><Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" /></div>
      </FormGrid>
      <div><Label>Estoque mínimo (alerta)</Label><Input type="number" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} min="0" /></div>

      {/* Entrada inicial */}
      <div className="border-t border-border pt-4 mt-2">
        <p className="text-sm font-medium text-muted-foreground mb-3">Entrada inicial (opcional)</p>
        <FormGrid>
          <div><Label>Quantidade</Label><Input type="number" value={qtdInicial} onChange={(e) => setQtdInicial(e.target.value)} min="0" placeholder="0" /></div>
          <div><Label>Custo unitário (R$)</Label><Input type="number" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} min="0" step="0.01" placeholder="0,00" /></div>
        </FormGrid>
        {Number(qtdInicial) > 0 && locais && locais.length > 0 && (
          <div className="mt-2">
            <Label>Depósito</Label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {locais.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </FormModalTemplate>
  );
}
