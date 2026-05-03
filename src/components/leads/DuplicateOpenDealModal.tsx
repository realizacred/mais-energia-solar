/**
 * DuplicateOpenDealModal — Modal amigável que avisa sobre projeto/deal aberto
 * existente para o mesmo cliente/telefone antes de criar um novo a partir do Lead.
 *
 * Ações:
 *   - Abrir projeto existente
 *   - Criar novo mesmo assim (exige justificativa, registra audit log)
 */
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ExternalLink, Plus, User, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OpenDealMatch } from "@/services/leads/findOpenDealForLeadOrCliente";

interface DuplicateOpenDealModalProps {
  open: boolean;
  matches: OpenDealMatch[];
  onOpenExisting: (match: OpenDealMatch) => void;
  onCreateAnyway: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DuplicateOpenDealModal({
  open,
  matches,
  onOpenExisting,
  onCreateAnyway,
  onCancel,
  loading = false,
}: DuplicateOpenDealModalProps) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirmCreate = () => {
    if (reason.trim().length < 10) return;
    onCreateAnyway(reason.trim());
    setReason("");
    setShowReason(false);
  };

  const handleCancel = () => {
    setReason("");
    setShowReason(false);
    onCancel();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Cliente já possui projeto/deal aberto
          </AlertDialogTitle>
          <AlertDialogDescription>
            Encontramos {matches.length === 1 ? "1 negócio aberto" : `${matches.length} negócios abertos`} para este cliente.
            Verifique antes de criar um novo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-2">
            {matches.map((m) => (
              <div
                key={m.deal_id}
                className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{m.cliente_nome ?? "Cliente"}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {m.match_reason === "telefone" ? "Telefone igual" : "Mesmo cliente"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {m.pipeline_nome && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {m.pipeline_nome}
                      {m.stage_nome ? ` · ${m.stage_nome}` : ""}
                    </span>
                  )}
                  {m.owner_nome && <span>Responsável: {m.owner_nome}</span>}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenExisting(m)}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir projeto existente
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {showReason && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">
              Justificativa para criar mesmo assim <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Novo projeto de outra unidade consumidora, cliente solicitou orçamento separado, etc. (mínimo 10 caracteres)"
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Esta ação será registrada no log de auditoria.
            </p>
          </div>
        )}

        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel disabled={loading} onClick={handleCancel} className="mt-0">
            Cancelar
          </AlertDialogCancel>
          {!showReason ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowReason(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Criar novo mesmo assim
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCreate}
              disabled={loading || reason.trim().length < 10}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Confirmar criação
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
