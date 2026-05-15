import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CreditBankConfig, useCreateCreditBankConfig, useUpdateCreditBankConfig } from "@/hooks/useCreditConfigs";

interface CreditBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank?: CreditBankConfig;
}

export function CreditBankDialog({ open, onOpenChange, bank }: CreditBankDialogProps) {
  const createMutation = useCreateCreditBankConfig();
  const updateMutation = useUpdateCreditBankConfig();
  const isEditing = !!bank;

  const { register, handleSubmit, reset, setValue, watch } = useForm<Partial<CreditBankConfig>>({
    defaultValues: {
      bank_name: "",
      is_active: true,
      prazo_medio: "",
      observacoes: "",
    }
  });

  useEffect(() => {
    if (bank) {
      reset({
        bank_name: bank.bank_name,
        is_active: bank.is_active,
        prazo_medio: bank.prazo_medio || "",
        observacoes: bank.observacoes || "",
      });
    } else {
      reset({
        bank_name: "",
        is_active: true,
        prazo_medio: "",
        observacoes: "",
      });
    }
  }, [bank, reset]);

  const onSubmit = async (data: Partial<CreditBankConfig>) => {
    try {
      if (isEditing && bank) {
        await updateMutation.mutateAsync({ id: bank.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (error) {
      // Toast já é tratado no hook
    }
  };

  const isActive = watch("is_active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Banco" : "Adicionar Banco"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bank_name">Nome do Banco</Label>
            <Input id="bank_name" {...register("bank_name", { required: true })} placeholder="Ex: Santander, BV, Solfácil" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prazo_medio">Prazo Médio</Label>
            <Input id="prazo_medio" {...register("prazo_medio")} placeholder="Ex: 3 a 5 dias úteis" />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="is_active">Status Ativo</Label>
            <Switch 
              id="is_active" 
              checked={isActive} 
              onCheckedChange={(checked) => setValue("is_active", checked)} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Internas</Label>
            <Textarea id="observacoes" {...register("observacoes")} placeholder="Notas sobre taxas, convênios ou processos específicos" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? "Salvar Alterações" : "Criar Banco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
