import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import {
  useCreateEstoqueItem, ESTOQUE_CATEGORIAS, ESTOQUE_UNIDADES, CATEGORIA_LABELS,
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

  useEffect(() => { if (open && defaultSku) { setSku(defaultSku); setCodigoBarras(defaultSku); } }, [open, defaultSku]);

  const createItem = useCreateEstoqueItem();

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
        onSuccess: () => {
          onOpenChange(false);
          setNome(""); setSku(""); setCategoria("geral"); setUnidade("UN");
          setEstoqueMinimo("0"); setFornecedor(""); setCodigoBarras("");
        },
      }
    );
  };

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Novo Item de Estoque"
      onSubmit={handleSubmit} submitLabel="Cadastrar" saving={createItem.isPending}
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
    </FormModalTemplate>
  );
}
