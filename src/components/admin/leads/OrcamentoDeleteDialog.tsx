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
import { Trash2 } from "lucide-react";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface OrcamentoDeleteDialogProps {
  orcamento: OrcamentoDisplayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function OrcamentoDeleteDialog({
  orcamento,
  open,
  onOpenChange,
  onConfirm,
}: OrcamentoDeleteDialogProps) {
  if (!orcamento) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[90vw] max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o orçamento{" "}
            <strong>{orcamento.orc_code || orcamento.id}</strong> de{" "}
            <strong>{orcamento.nome}</strong>? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
