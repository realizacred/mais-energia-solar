import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { useTransferirEstoque, useEstoqueLocais, type EstoqueSaldo } from "@/hooks/useEstoque";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saldos: EstoqueSaldo[];
}

export function TransferDialog({ open, onOpenChange, saldos }: TransferDialogProps) {
  const [itemId, setItemId] = useState("");
  const [localOrigem, setLocalOrigem] = useState("");
  const [localDestino, setLocalDestino] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const transferir = useTransferirEstoque();
  const { data: locais = [] } = useEstoqueLocais();

  const handleSubmit = () => {
    if (!itemId || !localOrigem || !localDestino || !quantidade || Number(quantidade) <= 0) return;
    if (localOrigem === localDestino) return;
    transferir.mutate(
      {
        item_id: itemId,
        local_origem: localOrigem,
        local_destino: localDestino,
        quantidade: Number(quantidade),
        observacao: observacao.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setItemId(""); setLocalOrigem(""); setLocalDestino(""); setQuantidade(""); setObservacao("");
        },
      }
    );
  };

  const activeItems = saldos.filter((s) => s.ativo);

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Transferência entre Depósitos"
      onSubmit={handleSubmit} submitLabel="Transferir" saving={transferir.isPending}
      disabled={!itemId || !localOrigem || !localDestino || localOrigem === localDestino || !quantidade || Number(quantidade) <= 0}
      asForm
    >
      <div>
        <Label>Item *</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
          <SelectContent>
            {activeItems.map((s) => (
              <SelectItem key={s.item_id} value={s.item_id}>{s.nome} ({s.estoque_atual} {s.unidade})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormGrid>
        <div>
          <Label>Depósito de origem *</Label>
          <Select value={localOrigem} onValueChange={setLocalOrigem}>
            <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              {locais.map((l) => (<SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Depósito de destino *</Label>
          <Select value={localDestino} onValueChange={setLocalDestino}>
            <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
            <SelectContent>
              {locais.filter((l) => l.id !== localOrigem).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormGrid>
      <FormGrid>
        <div><Label>Quantidade *</Label><Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="0.01" step="0.01" /></div>
      </FormGrid>
      <div><Label>Observação</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Motivo da transferência..." /></div>
    </FormModalTemplate>
  );
}
