import { useState } from "react";
import { Plus, Trash2, Edit, GripVertical, Info } from "lucide-react";
import { CreditBankConfig, useCreditBankChecklist, useDeleteCreditChecklistItem } from "@/hooks/useCreditConfigs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditChecklistDialog } from "./CreditChecklistDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CreditChecklistManagerProps {
  bank: CreditBankConfig;
}

export function CreditChecklistManager({ bank }: CreditChecklistManagerProps) {
  const { data: items, isLoading } = useCreditBankChecklist(bank.id);
  const deleteMutation = useDeleteCreditChecklistItem();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(undefined);

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedItem(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este documento do checklist?")) {
      await deleteMutation.mutateAsync({ id, bank_config_id: bank.id });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Checklist: {bank.bank_name}
        </h3>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Documento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum documento configurado para este banco.
          </p>
          <Button variant="link" size="sm" onClick={handleAdd}>
            Adicionar o primeiro
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {items?.map((item) => (
            <div 
              key={item.id}
              className="group flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.document_type_name}</span>
                    {item.is_required ? (
                      <Badge variant="destructive" className="h-5 text-[10px] uppercase">Obrigatório</Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-[10px] uppercase">Opcional</Badge>
                    )}
                    {item.applicable_to !== 'both' && (
                      <Badge variant="secondary" className="h-5 text-[10px] uppercase">
                        {item.applicable_to === 'pf' ? 'PF' : 'PJ'}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Info className="h-3 w-3" />
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreditChecklistDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        bankConfigId={bank.id}
        item={selectedItem}
      />
    </div>
  );
}
