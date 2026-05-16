import { useState } from "react";
import { Plus, Trash2, Edit2, FileText, CheckCircle2, User, Users } from "lucide-react";
import { 
  CreditBankConfig, 
  CreditChecklistItem, 
  useCreditBankChecklist,
  useCreateCreditChecklistItem,
  useUpdateCreditChecklistItem,
  useDeleteCreditChecklistItem
} from "@/hooks/useCreditConfigs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditChecklistDialog } from "./CreditChecklistDialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  bank: CreditBankConfig;
}

export function CreditChecklistManager({ bank }: Props) {
  const { data: checklist, isLoading } = useCreditBankChecklist(bank.id);
  const createMutation = useCreateCreditChecklistItem();
  const updateMutation = useUpdateCreditChecklistItem();
  const deleteMutation = useDeleteCreditChecklistItem();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CreditChecklistItem | undefined>(undefined);
  const [itemToDelete, setItemToDelete] = useState<CreditChecklistItem | null>(null);

  const handleAddItem = () => {
    setSelectedItem(undefined);
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: CreditChecklistItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      await deleteMutation.mutateAsync({ id: itemToDelete.id, bank_config_id: bank.id });
      setItemToDelete(null);
    }
  };

  if (isLoading) return <div className="space-y-3 p-4"><div className="h-10 bg-muted animate-pulse rounded" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Checklist: {bank.bank_name}
          </h3>
          <p className="text-xs text-muted-foreground">Configure os documentos obrigatórios para este banco.</p>
        </div>
        <Button size="sm" onClick={handleAddItem} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div className="space-y-3">
        {!checklist || checklist.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-xl border-2 border-dashed">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum requisito documental configurado.</p>
          </div>
        ) : (
          checklist.map((item) => (
            <div 
              key={item.id} 
              className="group p-4 bg-background border border-border/50 rounded-xl hover:border-primary/30 transition-all shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  item.is_required ? "bg-destructive/5 text-destructive" : "bg-muted text-muted-foreground"
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{item.document_type_name}</span>
                    {item.is_required && (
                      <Badge variant="destructive" className="text-[9px] h-4 px-1.5 uppercase tracking-wider font-black">Obrigatório</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1 uppercase">
                      {item.applicable_to === 'both' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {item.applicable_to === 'both' ? 'Ambos' : item.applicable_to.toUpperCase()}
                    </span>
                    {item.description && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[200px] italic">"{item.description}"</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditItem(item)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setItemToDelete(item)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <CreditChecklistDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        bankConfigId={bank.id} 
        item={selectedItem} 
      />

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item do checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O requisito documental será removido das configurações do banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { cn } from "@/lib/utils";
