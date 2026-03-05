import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { useCreateReserva, useEstoqueLocais, type EstoqueSaldo } from "@/hooks/useEstoque";

interface ReservaFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saldos: EstoqueSaldo[];
}

export function ReservaFormDialog({ open, onOpenChange, saldos }: ReservaFormDialogProps) {
  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [refType, setRefType] = useState("");
  const [observacao, setObservacao] = useState("");

  const createReserva = useCreateReserva();
  const { data: locais = [] } = useEstoqueLocais();

  const handleSubmit = () => {
    if (!itemId || !quantidade || Number(quantidade) <= 0) return;
    createReserva.mutate(
      {
        item_id: itemId,
        local_id: localId || null,
        quantidade_reservada: Number(quantidade),
        ref_type: refType || undefined,
        observacao: observacao.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setItemId(""); setLocalId(""); setQuantidade(""); setRefType(""); setObservacao("");
        },
      }
    );
  };

  const activeItems = saldos.filter((s) => s.ativo);

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Nova Reserva de Estoque"
      onSubmit={handleSubmit} submitLabel="Reservar" saving={createReserva.isPending}
      disabled={!itemId || !quantidade || Number(quantidade) <= 0} asForm
    >
      <div>
        <Label>Item *</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
          <SelectContent>
            {activeItems.map((s) => (
              <SelectItem key={s.item_id} value={s.item_id}>
                {s.nome} (disp: {s.disponivel} {s.unidade})
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
      <FormGrid>
        <div><Label>Quantidade *</Label><Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="0.01" step="0.01" /></div>
        <div>
          <Label>Tipo de referência</Label>
          <Select value={refType} onValueChange={setRefType}>
            <SelectTrigger><SelectValue placeholder="Projeto, OS..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="projeto">Projeto</SelectItem>
              <SelectItem value="os">Ordem de Serviço</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FormGrid>
      <div><Label>Observação</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ref. do projeto, cliente..." /></div>
    </FormModalTemplate>
  );
}
