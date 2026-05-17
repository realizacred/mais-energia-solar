import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { User, Phone, Plus, ExternalLink, AlertTriangle } from "lucide-react";
import { formatPhoneBR } from "@/lib/formatters";

export interface DuplicateLeadInfo {
  id: string;
  nome: string;
  consultor_nome: string | null;
}

interface DuplicateLeadWarningDialogProps {
  open: boolean;
  lead: DuplicateLeadInfo | null;
  onOpenExisting: (id: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}

export function DuplicateLeadWarningDialog({
  open,
  lead,
  onOpenExisting,
  onCreateAnyway,
  onCancel,
}: DuplicateLeadWarningDialogProps) {
  if (!lead) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Lead já existe com este telefone
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 border border-border">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">{lead.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Consultor: <span className="text-foreground">{lead.consultor_nome || "Sem consultor"}</span>
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Deseja abrir o cadastro existente ou criar um novo registro mesmo assim?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row mt-4">
          <AlertDialogCancel onClick={onCancel} className="sm:flex-1">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onOpenExisting(lead.id)}
            className="sm:flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Existente
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onCreateAnyway}
            className="sm:flex-1"
          >
            Criar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
