/**
 * DocumentSignersPanel — mostra status individual por signatário do documento.
 * Aparece abaixo do card quando o documento foi enviado e ainda não está totalmente assinado.
 */
import { Mail, Loader2, CheckCircle2, Eye, Clock, XCircle, MoreVertical, PenTool, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocumentSigners, useResendSigner, useUpdateSignerStatus, type DocumentSignerRow } from "@/hooks/useDocumentSigners";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  documentId: string;
  signatureStatus?: string | null;
}

const STATUS_BADGE: Record<DocumentSignerRow["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  signed:        { label: "Assinado",          cls: "bg-success/10 text-success border-success/20",       icon: <CheckCircle2 className="h-3 w-3" /> },
  signed_fisico: { label: "Assinado Físico",   cls: "bg-success/10 text-success border-success/20",       icon: <PenTool className="h-3 w-3" /> },
  viewed:        { label: "Visualizou",        cls: "bg-info/10 text-info border-info/20",                icon: <Eye className="h-3 w-3" /> },
  pending:       { label: "Pendente",          cls: "bg-warning/10 text-warning border-warning/20",       icon: <Clock className="h-3 w-3" /> },
  refused:       { label: "Recusou",           cls: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
  cancelled:     { label: "Cancelado",         cls: "bg-muted text-muted-foreground border-muted-foreground/20", icon: <Ban className="h-3 w-3" /> },
};

const BACKFILL_STATUSES = new Set(["sent", "viewed", "partially_signed"]);

export function DocumentSignersPanel({ documentId, signatureStatus }: Props) {
  const { data: signers = [], isLoading } = useDocumentSigners(documentId);
  const resend = useResendSigner();
  const updateStatus = useUpdateSignerStatus();
  const qc = useQueryClient();

  const [physicalSignModal, setPhysicalSignModal] = useState<DocumentSignerRow | null>(null);
  const [physicalSignDate, setPhysicalSignDate] = useState(new Date().toISOString().split("T")[0]);
  const [physicalSignObs, setPhysicalSignObs] = useState("");

  const triggeredRef = useRef<Set<string>>(new Set());
  const [backfilling, setBackfilling] = useState(false);

  // Auto-backfill: quando query terminou, sem signatários, e doc enviado.
  useEffect(() => {
    if (isLoading) return;
    if (signers.length > 0) return;
    if (!signatureStatus || !BACKFILL_STATUSES.has(signatureStatus)) return;
    if (triggeredRef.current.has(documentId)) return;

    triggeredRef.current.add(documentId);
    setBackfilling(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("signature-backfill-signers", {
          body: { document_id: documentId },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        qc.invalidateQueries({ queryKey: ["document-signers", documentId] });
        qc.invalidateQueries({ queryKey: ["document-signers"] });
      } catch (e) {
        console.warn("[DocumentSignersPanel] backfill falhou silenciosamente:", e);
      } finally {
        setBackfilling(false);
      }
    })();
  }, [isLoading, signers.length, signatureStatus, documentId, qc]);

  if (isLoading || backfilling) {
    return <div className="mx-3 mb-2 h-12 rounded-lg bg-muted/40 animate-pulse" />;
  }
  if (signers.length === 0) {
    if (signatureStatus && BACKFILL_STATUSES.has(signatureStatus)) {
      return (
        <div className="mt-2 p-3 border rounded-md bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Rastreamento por signatário não disponível para este envio.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Reenvie o documento para ativar o acompanhamento individual.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mx-3 mb-2 rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
        Signatários ({signers.filter(s => s.status === "signed").length}/{signers.length})
      </p>
      {signers.map((s) => {
        const cfg = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending;
        const canResend = s.status === "pending" || s.status === "viewed";
        return (
          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card border border-border/40">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {s.name}
                {s.role && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">• {s.role}</span>}
              </p>
              {s.email && (
                <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
              )}
            </div>
            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 gap-1", cfg.cls)}>
              {cfg.icon}
              {cfg.label}
            </Badge>
            {canResend && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-primary"
                title={s.last_resent_at ? `Reenviado em ${new Date(s.last_resent_at).toLocaleString("pt-BR")}` : "Reenviar e-mail"}
                onClick={() => resend.mutate(s.id)}
                disabled={resend.isPending}
              >
                {resend.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
