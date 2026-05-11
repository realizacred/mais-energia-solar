/**
 * Linha/card comercial de recuperação para a Inbox.
 *
 * Substitui a tabela administrativa por hierarquia visual SaaS premium:
 * cliente em destaque, valor grande, badges semânticas, ações claras.
 *
 * Reaproveita FollowupInboxRow (RB-76) — sem nova query, sem novo backend.
 */
import { useNavigate } from "react-router-dom";
import {
  Send,
  History,
  ExternalLink,
  Eye,
  Flame,
  ThermometerSun,
  Snowflake,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FollowupInboxRow } from "@/hooks/useFollowupComercial";
import { formatDiasParado } from "@/lib/formatters/diasParado";

const TZ = "America/Sao_Paulo";

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days >= 1) return `há ${days}d`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours >= 1) return `há ${hours}h`;
    const min = Math.max(1, Math.floor(diffMs / 60000));
    return `há ${min}min`;
  } catch {
    return "—";
  }
}

function formatAbsolute(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

const classeMeta: Record<
  string,
  { label: string; borderL: string; chip: string }
> = {
  sem_resposta: {
    label: "Sem resposta",
    borderL: "border-l-warning",
    chip: "bg-warning/10 text-warning border-warning/30",
  },
  visualizada_sem_retorno: {
    label: "Visualizada s/ retorno",
    borderL: "border-l-info",
    chip: "bg-info/10 text-info border-info/30",
  },
  esquecida: {
    label: "Esquecida",
    borderL: "border-l-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/30",
  },
  negociacao_quente: {
    label: "Quente",
    borderL: "border-l-success",
    chip: "bg-success/10 text-success border-success/30",
  },
  outro: {
    label: "—",
    borderL: "border-l-border",
    chip: "bg-muted text-muted-foreground border-border",
  },
};

function tempIcon(temp: string | null) {
  if (temp === "quente") return <Flame className="h-3 w-3" />;
  if (temp === "morna") return <ThermometerSun className="h-3 w-3" />;
  if (temp === "fria") return <Snowflake className="h-3 w-3" />;
  return null;
}

function tempTone(temp: string | null) {
  if (temp === "quente") return "text-success";
  if (temp === "morna") return "text-warning";
  if (temp === "fria") return "text-info";
  return "text-muted-foreground";
}

/** Heurística local de ação recomendada (read-only, sem nova IA). */
function suggestedAction(r: FollowupInboxRow): string {
  const dias = r.dias_parado ?? 0;
  if (r.temperatura === "quente") return "Enviar agora — lead quente";
  if (dias >= 60) return "Reaquecer com nova oferta";
  if (dias >= 30) return "Resgate prioritário";
  if ((r.total_aberturas ?? 0) > 0) return "Visualizou — perguntar dúvida";
  if (dias >= 7) return "Lembrete amigável";
  return "Aguardar 24h ou validar interesse";
}

interface Props {
  row: FollowupInboxRow;
  onSend: (row: FollowupInboxRow) => void;
  onHistory: (row: FollowupInboxRow) => void;
}

/** Severidade de inatividade — tokens semânticos, sem cor hardcoded. */
function inatividadeSeverity(dias: number | null | undefined): {
  label: string;
  chip: string;
} {
  const d = Math.floor(Number(dias ?? 0));
  if (d <= 3) return { label: "normal", chip: "bg-muted text-muted-foreground border-border" };
  if (d <= 15) return { label: "atenção", chip: "bg-warning/10 text-warning border-warning/30" };
  if (d <= 60) return { label: "risco", chip: "bg-destructive/10 text-destructive border-destructive/30" };
  return { label: "frio", chip: "bg-info/10 text-info border-info/30" };
}

export function FollowupRecoveryRow({ row, onSend, onHistory }: Props) {
  const navigate = useNavigate();
  const meta = classeMeta[row.classe_followup ?? "outro"] ?? classeMeta.outro;
  const action = suggestedAction(row);
  const projetoId = row.projeto_id;
  const sev = inatividadeSeverity(row.dias_parado);

  const goProposta = () => {
    if (!row.versao_id) return;
    navigate(`/admin/propostas-nativas/${row.proposta_id}/versoes/${row.versao_id}`);
  };
  const goProjeto = () => {
    if (!projetoId) return;
    navigate(`/admin/projetos?projeto=${projetoId}`);
  };

  return (
    <li
      className={`group bg-card border-l-[3px] ${meta.borderL} border-y border-r border-border first:rounded-t-lg last:rounded-b-lg -mt-px first:mt-0 hover:bg-muted/30 transition-colors`}
    >
      {/* ===== Mobile: card vertical ===== */}
      <div className="md:hidden p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">
              {row.cliente_nome ?? "Cliente sem nome"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {row.codigo ? `${row.codigo} · ` : ""}
              {row.titulo ?? "Sem título"}
            </div>
          </div>
          <Badge variant="outline" className={`${meta.chip} text-[10px] shrink-0`}>
            {meta.label}
          </Badge>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
              Valor
            </div>
            <div className="text-xl font-bold text-foreground tabular-nums leading-tight">
              {formatBRL(row.valor_total)}
            </div>
            {row.potencia_kwp != null && (
              <div className="text-[11px] text-muted-foreground">
                {Number(row.potencia_kwp).toFixed(2)} kWp
              </div>
            )}
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className={`flex items-center gap-1 justify-end ${tempTone(row.temperatura)}`}>
              {tempIcon(row.temperatura)}
              <span className="font-medium capitalize">{row.temperatura ?? "—"}</span>
              {row.score_ia != null && (
                <span className="opacity-70 ml-1">({row.score_ia})</span>
              )}
            </div>
            <div className="text-muted-foreground">
              {formatDiasParado(row.dias_parado)}
            </div>
            <div className="text-muted-foreground" title={formatAbsolute(row.ultima_atividade_em)}>
              {row.total_aberturas ?? 0} aberturas · {formatRelative(row.ultima_atividade_em)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-foreground/80 bg-muted/40 rounded px-2 py-1.5">
          <Sparkles className="h-3 w-3 text-info shrink-0" />
          <span className="truncate">{action}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="default"
            disabled={!row.telefone_normalized}
            onClick={() => onSend(row)}
          >
            <Send className="h-3.5 w-3.5 mr-1" /> Enviar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onHistory(row)}>
            <History className="h-3.5 w-3.5 mr-1" /> Histórico
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!row.versao_id}
            onClick={goProposta}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> Proposta
          </Button>
        </div>
      </div>

      {/* ===== Desktop: linha rica ===== */}
      <div className="hidden md:grid grid-cols-12 gap-3 items-center px-4 py-3">
        {/* Cliente + proposta */}
        <div className="col-span-3 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {row.cliente_nome ?? "Cliente sem nome"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {row.codigo ? `${row.codigo} · ` : ""}
            {row.titulo ?? "Sem título"}
          </div>
          <Badge variant="outline" className={`${meta.chip} text-[10px] mt-1.5`}>
            {meta.label}
          </Badge>
        </div>

        {/* Valor + kWp */}
        <div className="col-span-2 min-w-0">
          <div className="text-lg font-bold text-foreground tabular-nums leading-tight truncate">
            {formatBRL(row.valor_total)}
          </div>
          {row.potencia_kwp != null && (
            <div className="text-[11px] text-muted-foreground tabular-nums truncate">
              {Number(row.potencia_kwp).toFixed(2)} kWp
            </div>
          )}
        </div>

        {/* Temperatura + dias + engajamento (consolidado) */}
        <div className="col-span-2 min-w-0">
          <div className={`flex items-center gap-1 text-xs font-medium min-w-0 ${tempTone(row.temperatura)}`}>
            <span className="shrink-0">{tempIcon(row.temperatura)}</span>
            <span className="capitalize truncate">{row.temperatura ?? "—"}</span>
            {row.score_ia != null && (
              <span className="text-muted-foreground ml-1 font-mono shrink-0">{row.score_ia}/100</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{formatDiasParado(row.dias_parado)}</span>
            <Badge variant="outline" className={`${sev.chip} text-[9px] px-1 py-0 leading-tight shrink-0`}>
              {sev.label}
            </Badge>
          </div>
          <div
            className="text-[11px] text-muted-foreground truncate"
            title={formatAbsolute(row.ultima_atividade_em)}
          >
            {row.total_aberturas ?? 0} abert · {formatRelative(row.ultima_atividade_em)}
          </div>
        </div>

        {/* Ação recomendada — pill isolada, máx 2 linhas, oculta em <lg */}
        <div className="hidden lg:block lg:col-span-2 min-w-0">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-start gap-1.5 text-[11px] text-foreground/80 bg-muted/40 rounded px-2 py-1.5 min-w-0 cursor-default">
                  <Sparkles className="h-3 w-3 text-info shrink-0 mt-0.5" />
                  <span className="line-clamp-2 break-words">{action}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {action}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Cluster de ações — col-span maior em md, recolhe em lg */}
        <div className="col-span-5 lg:col-span-3 flex justify-end items-center shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <RowActions
            row={row}
            projetoId={projetoId}
            onSend={onSend}
            onHistory={onHistory}
            onProposta={goProposta}
            onProjeto={goProjeto}
          />
        </div>
      </div>
    </li>
  );
}

function RowActions({
  row,
  projetoId,
  onSend,
  onHistory,
  onProposta,
  onProjeto,
}: {
  row: FollowupInboxRow;
  projetoId: string | null;
  onSend: (r: FollowupInboxRow) => void;
  onHistory: (r: FollowupInboxRow) => void;
  onProposta: () => void;
  onProjeto: () => void;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1 flex-nowrap shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!row.versao_id}
                onClick={onProposta}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{row.versao_id ? "Ver proposta" : "Versão indisponível"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!projetoId}
                onClick={onProjeto}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {projetoId ? "Ver projeto" : "Projeto não vinculado"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onHistory(row)}
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Histórico de tentativas</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="default"
                className="h-8 ml-1"
                disabled={!row.telefone_normalized}
                onClick={() => onSend(row)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {row.telefone_normalized
              ? "Abre preview com guardrails (não envia direto)"
              : "Cliente sem telefone"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
