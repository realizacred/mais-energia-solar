/**
 * ProposalSuggestionReview — painel de revisão humana para sugestões de IA
 * de follow-up por proposta. Reaproveita wa_followup_queue (sem novas tabelas).
 * NÃO envia mensagens; apenas editar/copiar/rejeitar/adiar.
 * RB-76 / AGENTS.md v4.
 */
import { useState } from "react";
import { Copy, Edit3, X, Clock, ExternalLink, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  type FollowupQueueItem,
  useEditProposalSuggestion,
  useRejectProposalSuggestion,
  usePostponeProposalSuggestion,
  useApproveProposalFollowup,
} from "@/hooks/useWaFollowup";
import { formatDateTime, formatDate } from "@/lib/dateUtils";

function fmtCurrency(v: any): string {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtKwp(v: any): string {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp`;
}

interface Props {
  item: FollowupQueueItem;
}

export function ProposalSuggestionReview({ item }: Props) {
  const ctx = (item.proposal_context || {}) as Record<string, any>;
  const meta = (item.metadata || {}) as Record<string, any>;
  const isFallback = meta.ai_fallback === true;
  const isAiGenerated = meta.ai_generated === true;
  const wasEdited = meta.human_edited === true;

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [draft, setDraft] = useState(item.mensagem_sugerida || "");
  const [rejectReason, setRejectReason] = useState("");
  const [postponeAt, setPostponeAt] = useState("");
  const [postponeReason, setPostponeReason] = useState("");

  const editMut = useEditProposalSuggestion();
  const rejectMut = useRejectProposalSuggestion();
  const postponeMut = usePostponeProposalSuggestion();
  const approveMut = useApproveProposalFollowup();

  const canApprove =
    item.status === "pendente_revisao" &&
    !!item.mensagem_sugerida?.trim() &&
    !!item.conversation_id &&
    !!item.proposta_id;

  const handleApprove = () => {
    if (!canApprove) return;
    if (!confirm("Enviar esta mensagem ao cliente agora?")) return;
    approveMut.mutate(
      { item },
      {
        onSuccess: () => toast.success("Mensagem enviada"),
        onError: (e: any) => toast.error(e?.message || "Erro ao enviar"),
      },
    );
  };

  const handleCopy = async () => {
    if (!item.mensagem_sugerida) return;
    try {
      await navigator.clipboard.writeText(item.mensagem_sugerida);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleEditSave = () => {
    if (!draft.trim()) {
      toast.error("Mensagem não pode ser vazia");
      return;
    }
    editMut.mutate(
      { item, mensagem: draft.trim() },
      {
        onSuccess: () => { toast.success("Sugestão atualizada"); setEditOpen(false); },
        onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
      },
    );
  };

  const handleReject = () => {
    rejectMut.mutate(
      { item, reason: rejectReason.trim() || undefined },
      {
        onSuccess: () => { toast.success("Sugestão rejeitada"); setRejectOpen(false); },
        onError: (e: any) => toast.error(e?.message || "Erro ao rejeitar"),
      },
    );
  };

  const handlePostpone = () => {
    if (!postponeAt) {
      toast.error("Informe nova data");
      return;
    }
    const iso = new Date(postponeAt).toISOString();
    postponeMut.mutate(
      { item, scheduledAt: iso, reason: postponeReason.trim() || undefined },
      {
        onSuccess: () => { toast.success("Reagendado"); setPostponeOpen(false); },
        onError: (e: any) => toast.error(e?.message || "Erro ao reagendar"),
      },
    );
  };

  const propostaHref = item.proposta_id && item.versao_id
    ? `/admin/propostas-nativas/${item.proposta_id}/versoes/${item.versao_id}`
    : null;

  return (
    <div className="p-4 border-b bg-card space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="bg-info/10 text-info border-info/30">
          <Sparkles className="w-3 h-3 mr-1" />
          Follow-up de proposta
        </Badge>
        {item.cenario && (
          <Badge variant="outline" className="capitalize">
            {item.cenario.replace(/_/g, " ")}
          </Badge>
        )}
        {isAiGenerated && !isFallback && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">IA gerada</Badge>
        )}
        {isFallback && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Template fallback</Badge>
        )}
        {wasEdited && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">Editada</Badge>
        )}
        {meta.risco && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            Risco: {String(meta.risco)}
          </Badge>
        )}
        {meta.nivel_urgencia && (
          <Badge variant="outline">Urgência: {String(meta.nivel_urgencia)}</Badge>
        )}
      </div>

      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
        <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning-foreground">
          Modo seguro: revisão humana obrigatória. Nenhuma mensagem é enviada automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><strong>Cliente:</strong> {ctx.cliente_nome || "—"}</div>
        <div><strong>Status proposta:</strong> {ctx.status_proposta || "—"}</div>
        <div><strong>Valor:</strong> {fmtCurrency(ctx.valor_total)}</div>
        <div><strong>Potência:</strong> {fmtKwp(ctx.potencia_kwp)}</div>
        <div><strong>Enviado:</strong> {formatDateTime(ctx.enviado_em)}</div>
        <div><strong>Visualizado:</strong> {ctx.viewed_at ? formatDateTime(ctx.viewed_at) : "—"}</div>
        <div><strong>Validade:</strong> {formatDate(ctx.valido_ate)}</div>
        <div><strong>Dias s/ resposta:</strong> {ctx.dias_sem_resposta ?? "—"}</div>
      </div>

      {item.ai_reason && (
        <div className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
          <strong>Motivo IA:</strong> {item.ai_reason}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Mensagem sugerida</div>
        {item.mensagem_sugerida ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{item.mensagem_sugerida}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Aguardando sugestão da IA</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy} disabled={!item.mensagem_sugerida}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setDraft(item.mensagem_sugerida || ""); setEditOpen(true); }}>
          <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPostponeOpen(true)}>
          <Clock className="w-3.5 h-3.5 mr-1" /> Adiar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setRejectOpen(true)}
          disabled={item.status === "cancelado"}
        >
          <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
        </Button>
        {propostaHref ? (
          <Button size="sm" variant="ghost" asChild>
            <a href={propostaHref} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir proposta
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled title="Rota da proposta não disponível">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir proposta
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={!canApprove || approveMut.isPending}
          title={!canApprove ? "Item não está pronto para envio" : "Aprovar e enviar pelo WhatsApp"}
        >
          {approveMut.isPending ? "Enviando..." : "Aprovar e enviar"}
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mensagem sugerida</DialogTitle>
            <DialogDescription>
              A edição mantém o item em revisão. Nenhuma mensagem é enviada.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            placeholder="Mensagem para o cliente..."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editMut.isPending}>
              {editMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar sugestão</DialogTitle>
            <DialogDescription>
              O item será marcado como cancelado e não será enviado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Motivo (opcional)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMut.isPending}>
              {rejectMut.isPending ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Postpone dialog */}
      <Dialog open={postponeOpen} onOpenChange={setPostponeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adiar sugestão</DialogTitle>
            <DialogDescription>
              Reagenda o item. O status permanece em revisão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Nova data/hora</label>
            <input
              type="datetime-local"
              value={postponeAt}
              onChange={(e) => setPostponeAt(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Textarea
              value={postponeReason}
              onChange={(e) => setPostponeReason(e.target.value)}
              rows={3}
              placeholder="Motivo (opcional)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPostponeOpen(false)}>Cancelar</Button>
            <Button onClick={handlePostpone} disabled={postponeMut.isPending}>
              {postponeMut.isPending ? "Salvando..." : "Reagendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProposalSuggestionReview;
