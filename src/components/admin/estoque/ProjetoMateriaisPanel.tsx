/**
 * Panel to manage materials linked to a project (reserve/consume/cancel).
 * Drop into any project detail view.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { SectionCard } from "@/components/ui-kit";
import { Package, Plus, CheckCircle, XCircle } from "lucide-react";
import {
  useProjetoMateriais,
  useEstoqueSaldos,
  useEstoqueLocais,
  useReservarMaterialProjeto,
  useConsumirProjeto,
  useCancelarReservasProjeto,
  type ProjetoMaterial,
} from "@/hooks/useEstoque";

const statusStyles: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  reservado: "bg-warning/10 text-warning",
  consumido: "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};
const statusLabels: Record<string, string> = {
  pendente: "Pendente", reservado: "Reservado", consumido: "Consumido", cancelado: "Cancelado",
};

interface Props {
  projetoId: string;
}

export function ProjetoMateriaisPanel({ projetoId }: Props) {
  const [addDialog, setAddDialog] = useState(false);
  const { data: materiais = [], isLoading } = useProjetoMateriais(projetoId);
  const consumirProjeto = useConsumirProjeto();
  const cancelarReservas = useCancelarReservasProjeto();

  const hasReservados = materiais.some((m) => m.status === "reservado");

  return (
    <SectionCard icon={Package} title="Materiais do Projeto">
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />Adicionar Material
        </Button>
        {hasReservados && (
          <>
            <Button size="sm" variant="default"
              disabled={consumirProjeto.isPending}
              onClick={() => consumirProjeto.mutate(projetoId)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />Consumir Todos
            </Button>
            <Button size="sm" variant="destructive"
              disabled={cancelarReservas.isPending}
              onClick={() => cancelarReservas.mutate(projetoId)}
            >
              <XCircle className="h-4 w-4 mr-1" />Cancelar Reservas
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : materiais.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum material vinculado.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Qtd</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Local</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {materiais.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium text-foreground">{m.item_nome}</td>
                  <td className="p-3 text-right font-semibold">{m.quantidade}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">{m.local_nome || "—"}</td>
                  <td className="p-3 text-center">
                    <Badge className={`text-[10px] ${statusStyles[m.status] || ""}`}>
                      {statusLabels[m.status] || m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddMaterialDialog open={addDialog} onOpenChange={setAddDialog} projetoId={projetoId} />
    </SectionCard>
  );
}

function AddMaterialDialog({ open, onOpenChange, projetoId }: { open: boolean; onOpenChange: (o: boolean) => void; projetoId: string }) {
  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const { data: saldos = [] } = useEstoqueSaldos();
  const { data: locais = [] } = useEstoqueLocais();
  const reservar = useReservarMaterialProjeto();

  const activeItems = saldos.filter((s) => s.ativo && s.disponivel > 0);

  const handleSubmit = () => {
    if (!itemId || !quantidade || Number(quantidade) <= 0) return;
    reservar.mutate(
      { projeto_id: projetoId, item_id: itemId, local_id: localId || null, quantidade: Number(quantidade) },
      {
        onSuccess: () => {
          onOpenChange(false);
          setItemId(""); setLocalId(""); setQuantidade("");
        },
      }
    );
  };

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Adicionar Material ao Projeto"
      onSubmit={handleSubmit} submitLabel="Reservar" saving={reservar.isPending}
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
      <FormGrid>
        <div><Label>Quantidade *</Label><Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="0.01" step="0.01" /></div>
      </FormGrid>
    </FormModalTemplate>
  );
}
