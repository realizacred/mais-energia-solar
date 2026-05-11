import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface NewVersionConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function NewVersionConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: NewVersionConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Criar nova versão da proposta?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-5">
          <DialogDescription className="text-sm text-foreground leading-relaxed">
            Esta proposta já foi enviada ao cliente. Ao continuar, uma nova versão será criada com um novo link. O cliente precisará receber o link atualizado.
          </DialogDescription>
        </div>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Criar nova versão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
