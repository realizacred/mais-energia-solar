/**
 * ProposalStatusActions.tsx
 * 
 * Accept/Reject/OS buttons for ProposalDetail.
 * Handles dialog state internally but delegates mutations to parent.
 */

import { useState } from "react";
import {
  CheckCircle2, XCircle, Wrench, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ProposalViewModel } from "@/domain/proposal/ProposalViewModel";
import { isActionableStatus, canAccept, canReject, canGenerateOs } from "@/domain/proposal/proposalState";

interface ProposalStatusActionsProps {
  vm: ProposalViewModel;
  existingOs: Record<string, any> | null;
  updatingStatus: boolean;
  generatingOs: boolean;
  onUpdateStatus: (newStatus: string, extra?: { motivo?: string; data?: string }) => void;
  onGenerateOs: () => void;
}

export function ProposalStatusActions({
  vm, existingOs, updatingStatus, generatingOs,
  onUpdateStatus, onGenerateOs,
}: ProposalStatusActionsProps) {
  const [aceiteDialogOpen, setAceiteDialogOpen] = useState(false);
  const [aceiteDate, setAceiteDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [aceiteMotivo, setAceiteMotivo] = useState("");
  const [recusaDate, setRecusaDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [recusaMotivo, setRecusaMotivo] = useState("");

  const currentStatus = vm.businessStatus;
  const isActionable = isActionableStatus(currentStatus);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Accept / Remove Accept */}
      {isActionable && canAccept(currentStatus) && (
        vm.isAccepted ? (
          <Button size="sm" variant="destructive" className="gap-1.5 border-success/40 text-success" onClick={() => onUpdateStatus("enviada")} disabled={updatingStatus}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Remover Aceite
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => { setAceiteDate(new Date().toISOString().slice(0, 16)); setAceiteMotivo(""); setAceiteDialogOpen(true); }} disabled={updatingStatus}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar
          </Button>
        )
      )}

      {/* Reject / Remove Reject */}
      {isActionable && canReject(currentStatus) && (
        vm.isRejected ? (
          <Button size="sm" variant="destructive" className="gap-1.5 border-destructive/40 text-destructive" onClick={() => onUpdateStatus("enviada")} disabled={updatingStatus}>
            <XCircle className="h-3.5 w-3.5" /> Remover Recusa
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5" disabled={updatingStatus} onClick={() => setRecusaDate(new Date().toISOString().slice(0, 16))}>
                <XCircle className="h-3.5 w-3.5" /> Recusar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
                <AlertDialogDescription>Informe o motivo e a data da recusa.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Data da recusa</label>
                  <Input type="datetime-local" value={recusaDate} onChange={(e) => setRecusaDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
                  <Textarea placeholder="Motivo da recusa..." value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)} className="min-h-[80px]" />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { onUpdateStatus("recusada", { motivo: recusaMotivo, data: new Date(recusaDate).toISOString() }); setRecusaMotivo(""); }}>
                  Confirmar Recusa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      )}

      {/* Accept Dialog */}
      <AlertDialog open={aceiteDialogOpen} onOpenChange={setAceiteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aceitar proposta?</AlertDialogTitle>
            <AlertDialogDescription>Informe o motivo e a data do aceite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data do aceite</label>
              <Input type="datetime-local" value={aceiteDate} onChange={(e) => setAceiteDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Motivo / Observação (opcional)</label>
              <Textarea placeholder="Motivo do aceite..." value={aceiteMotivo} onChange={(e) => setAceiteMotivo(e.target.value)} className="min-h-[80px]" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-success text-success-foreground hover:bg-success/90" onClick={() => { onUpdateStatus("aceita", { motivo: aceiteMotivo, data: new Date(aceiteDate).toISOString() }); setAceiteMotivo(""); setAceiteDialogOpen(false); }}>
              Confirmar Aceite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OS */}
      {canGenerateOs(currentStatus) && (
        existingOs ? (
          <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3"><Wrench className="h-3.5 w-3.5" /> OS {existingOs.numero_os} • {existingOs.status}</Badge>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary" onClick={onGenerateOs} disabled={generatingOs}>
            {generatingOs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />} Gerar OS
          </Button>
        )
      )}
    </div>
  );
}
