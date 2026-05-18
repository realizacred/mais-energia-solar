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
import { Archive } from "lucide-react";
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
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5 text-primary" />
            </div>
            <AlertDialogTitle>Arquivar Lead/Orçamento</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Tem certeza que deseja arquivar o lead <strong>{orcamento.nome}</strong>?
            <br /><br />
            Este lead deixará de aparecer no funil principal. O histórico de orçamentos, 
            atividades e WhatsApp será preservado para auditoria.
            <br /><br />
            <span className="text-xs text-muted-foreground">
              * Só é possível arquivar leads sem propostas aceitas ou vendas concluídas.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="border-primary text-primary hover:bg-primary/10 border bg-transparent"
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
