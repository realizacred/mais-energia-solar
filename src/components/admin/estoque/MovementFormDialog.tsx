import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { useCreateMovimento, useEstoqueLocais, type EstoqueSaldo } from "@/hooks/useEstoque";

interface MovementFormDialogProps {
  open: boolean;
  tipo: "entrada" | "saida" | "ajuste";
  onOpenChange: () => void;
  saldos: EstoqueSaldo[];
}

export function MovementFormDialog({ open, tipo, onOpenChange, saldos }: MovementFormDialogProps) {
  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ajusteSinal, setAjusteSinal] = useState<"1" | "-1">("1");

  const createMov = useCreateMovimento();
  const { data: locais = [] } = useEstoqueLocais();

  const handleSubmit = () => {
    if (!itemId || !quantidade || Number(quantidade) <= 0) return;
    createMov.mutate(
      {
        item_id: itemId,
        local_id: localId || null,
        tipo,
        quantidade: Number(quantidade),
        custo_unitario: tipo === "entrada" && custoUnitario ? Number(custoUnitario) : null,
        origem: tipo === "entrada" ? "purchase" : tipo === "ajuste" ? "adjustment" : "manual",
        observacao: observacao.trim() || undefined,
        ajuste_sinal: tipo === "ajuste" ? Number(ajusteSinal) : 1,
      },
      {
        onSuccess: () => {
          onOpenChange();
          setItemId(""); setLocalId(""); setQuantidade(""); setCustoUnitario(""); setObservacao(""); setAjusteSinal("1");
        },
      }
    );
  };

  const activeItems = saldos.filter((s) => s.ativo);

  const title = tipo === "entrada" ? "Registrar Entrada" : tipo === "saida" ? "Registrar Saída" : "Registrar Ajuste";
  const submitLabel = tipo === "entrada" ? "Confirmar Entrada" : tipo === "saida" ? "Confirmar Saída" : "Confirmar Ajuste";

  return (
    <FormModalTemplate open={open} onOpenChange={() => onOpenChange()}
      title={title}
      onSubmit={handleSubmit}
      submitLabel={submitLabel}
      saving={createMov.isPending}
      disabled={!itemId || !quantidade || Number(quantidade) <= 0} asForm
    >
      <div>
        <Label>Item *</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
          <SelectContent>
            {activeItems.map((s) => (
              <SelectItem key={s.item_id} value={s.item_id}>
                {s.nome} ({s.disponivel} {s.unidade} disp.)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {locais.length > 0 && (
        <div>
          <Label>Depósito</Label>
          <Select value={localId} onValueChange={setLocalId}>
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              {locais.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}
      {tipo === "ajuste" && (
        <div>
          <Label>Tipo de ajuste *</Label>
          <Select value={ajusteSinal} onValueChange={(v) => setAjusteSinal(v as "1" | "-1")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">▲ Aumentar estoque</SelectItem>
              <SelectItem value="-1">▼ Reduzir estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <FormGrid>
        <div><Label>Quantidade *</Label><Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="0.01" step="0.01" /></div>
        {tipo === "entrada" && (
          <div><Label>Custo unitário (R$)</Label><Input type="number" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} min="0" step="0.01" /></div>
        )}
      </FormGrid>
      <div><Label>Observação</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="NF, projeto, motivo..." /></div>
    </FormModalTemplate>
  );
}
