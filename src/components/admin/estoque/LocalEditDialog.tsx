import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { useCreateEstoqueLocal, useUpdateEstoqueLocal, type EstoqueLocal } from "@/hooks/useEstoque";

interface LocalEditDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  local: EstoqueLocal | null;
}

export function LocalEditDialog({ open, onOpenChange, local }: LocalEditDialogProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("warehouse");

  const createLocal = useCreateEstoqueLocal();
  const updateLocal = useUpdateEstoqueLocal();
  const isEdit = !!local;

  useEffect(() => {
    if (local) {
      setNome(local.nome);
      setTipo(local.tipo);
    } else {
      setNome("");
      setTipo("warehouse");
    }
  }, [local, open]);

  const handleSubmit = () => {
    if (!nome.trim()) return;
    if (isEdit) {
      updateLocal.mutate(
        { id: local.id, nome: nome.trim(), tipo },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createLocal.mutate(
        { nome: nome.trim(), tipo },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar Depósito" : "Novo Depósito"}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? "Salvar" : "Criar"}
      saving={createLocal.isPending || updateLocal.isPending}
      disabled={!nome.trim()}
      asForm
    >
      <div>
        <Label>Nome *</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Almoxarifado central" />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="warehouse">Almoxarifado</SelectItem>
            <SelectItem value="vehicle">Veículo</SelectItem>
            <SelectItem value="site">Obra</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FormModalTemplate>
  );
}
