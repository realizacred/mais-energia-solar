import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { useCreateEstoqueLocal } from "@/hooks/useEstoque";

interface LocalFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function LocalFormDialog({ open, onOpenChange }: LocalFormDialogProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("warehouse");

  const createLocal = useCreateEstoqueLocal();

  const handleSubmit = () => {
    if (!nome.trim()) return;
    createLocal.mutate(
      { nome: nome.trim(), tipo },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNome(""); setTipo("warehouse");
        },
      }
    );
  };

  return (
    <FormModalTemplate open={open} onOpenChange={onOpenChange} title="Novo Depósito"
      onSubmit={handleSubmit} submitLabel="Criar" saving={createLocal.isPending}
      disabled={!nome.trim()} asForm
    >
      <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Almoxarifado central" /></div>
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
