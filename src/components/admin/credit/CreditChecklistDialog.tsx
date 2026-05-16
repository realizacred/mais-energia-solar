import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditChecklistItem, useCreateCreditChecklistItem, useUpdateCreditChecklistItem } from "@/hooks/useCreditConfigs";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";

interface CreditChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankConfigId: string;
  item?: CreditChecklistItem;
}

const DOCUMENT_SUGGESTIONS = [
  "RG/CNH",
  "CPF/CNPJ",
  "Comprovante de residência",
  "Comprovante de renda",
  "Contrato social",
  "Documentos dos sócios",
  "Faturamento/extrato",
  "Conta de luz",
  "Proposta/orçamento",
  "Documentos do imóvel",
  "Selfie com documento",
  "IPTU",
  "Fotos Telhado",
  "ART",
  "Contrato"
];

export function CreditChecklistDialog({ open, onOpenChange, bankConfigId, item }: CreditChecklistDialogProps) {
  const createMutation = useCreateCreditChecklistItem();
  const updateMutation = useUpdateCreditChecklistItem();
  const isEditing = !!item;

  const { register, handleSubmit, reset, setValue, watch } = useForm<Partial<CreditChecklistItem>>({
    defaultValues: {
      document_type_name: "",
      is_required: true,
      applicable_to: 'both',
      sort_order: 0,
      description: ""
    }
  });

  useEffect(() => {
    if (item) {
      reset({
        document_type_name: item.document_type_name,
        is_required: item.is_required,
        applicable_to: item.applicable_to,
        sort_order: item.sort_order,
        description: item.description || ""
      });
    } else {
      reset({
        document_type_name: "",
        is_required: true,
        applicable_to: 'both',
        sort_order: 0,
        description: ""
      });
    }
  }, [item, reset]);

  const onSubmit = async (data: Partial<CreditChecklistItem>) => {
    try {
      if (isEditing && item) {
        await updateMutation.mutateAsync({ id: item.id, ...data });
      } else {
        await createMutation.mutateAsync({ ...data, bank_config_id: bankConfigId });
      }
      onOpenChange(false);
    } catch (error) {}
  };

  const isRequired = watch("is_required");
  const applicableTo = watch("applicable_to");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Documento" : "Exigir Documento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="document_type_name">Nome do Documento</Label>
            <div className="relative">
              <Input 
                id="document_type_name" 
                {...register("document_type_name", { required: true })} 
                placeholder="Ex: RG/CNH" 
                list="doc-suggestions"
              />
              <datalist id="doc-suggestions">
                {DOCUMENT_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aplicável Para</Label>
              <Select 
                value={applicableTo} 
                onValueChange={(val: 'pf' | 'pj' | 'both') => setValue("applicable_to", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">PF & PJ</SelectItem>
                  <SelectItem value="pf">Apenas PF</SelectItem>
                  <SelectItem value="pj">Apenas PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Ordem</Label>
              <Input 
                id="sort_order" 
                type="number" 
                {...register("sort_order", { valueAsNumber: true })} 
              />
            </div>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="is_required">Documento Obrigatório</Label>
            <Switch 
              id="is_required" 
              checked={isRequired} 
              onCheckedChange={(checked) => setValue("is_required", checked)} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Instruções para o Consultor (opcional)</Label>
            <Input id="description" {...register("description")} placeholder="Ex: Deve estar dentro da validade" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? "Salvar Alterações" : "Adicionar Documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
