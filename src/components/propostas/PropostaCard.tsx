import { useMemo } from "react";
import {
  Calendar,
  Zap,
  DollarSign,
  ExternalLink,
  Copy,
  MessageCircle,
  SunMedium,
  Package,
  TrendingUp,
  Clock,
  Flame,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import type { Proposta } from "@/hooks/usePropostas";
import {
  extractProposalSummary,
  type ProposalSummary,
} from "@/lib/solarMarket/extractProposalSummary";
import { formatProposalMessage } from "@/lib/solarMarket/formatProposalMessage";

// ── Status badges ──

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  enviada: { label: "Enviada", color: "bg-info/15 text-info" },
  visualizada: { label: "Visualizada", color: "bg-warning/15 text-warning" },
  aceita: { label: "Aceita", color: "bg-success/15 text-success" },
  recusada: { label: "Recusada", color: "bg-destructive/15 text-destructive" },
  expirada: { label: "Expirada", color: "bg-muted text-muted-foreground" },
  generated: { label: "Gerada", color: "bg-info/15 text-info" },
};

// ── Priority indicators ──

interface PriorityTag {
  icon: typeof Flame;
  label: string;
  className: string;
}

function derivePriority(proposta: Proposta, summary: ProposalSummary): PriorityTag | null {
  // Expiring soon (< 5 days)
  if (proposta.expiration_date) {
    const daysLeft = differenceInDays(new Date(proposta.expiration_date), new Date());
    if (daysLeft >= 0 && daysLeft <= 5) {
      return {
        icon: AlertTriangle,
        label: `Expira em ${daysLeft}d`,
        className: "bg-destructive/15 text-destructive",
      };
    }
  }

  // Viewed but no response
  if (proposta.status === "visualizada") {
    return {
      icon: Eye,
      label: "Visualizou",
      className: "bg-warning/15 text-warning",
    };
  }

  // High savings (> R$ 500/mês)
  const economiaMensal = proposta.economia_mensal ?? summary.savings?.monthly;
  if (economiaMensal && economiaMensal > 500) {
    return {
      icon: TrendingUp,
      label: "Alta economia",
      className: "bg-success/15 text-success",
    };
  }

  // Hot lead: recently created and high value
  const daysSinceCreation = differenceInDays(new Date(), new Date(proposta.created_at));
  if (daysSinceCreation <= 3 && proposta.preco_total && proposta.preco_total > 10000) {
    return {
      icon: Flame,
      label: "Quente",
      className: "bg-warning/15 text-warning",
    };
  }

  return null;
}

// ── Formatters ──

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtNumber(v: number | null | undefined, suffix?: string): string {
  if (v == null) return "—";
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(v);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

// ── Card component ──

interface PropostaCardProps {
  proposta: Proposta;
  onOpenDetail: (p: Proposta) => void;
  onWhatsApp: (p: Proposta, summary: ProposalSummary) => void;
}

export function PropostaCard({ proposta, onOpenDetail, onWhatsApp }: PropostaCardProps) {
  const summary = useMemo(
    () => extractProposalSummary(proposta.raw_payload),
    [proposta.raw_payload]
  );

  const status = STATUS_MAP[proposta.status] ?? STATUS_MAP.pendente;
  const priority = derivePriority(proposta, summary);

  // Merge: structured columns take precedence, fall back to summary
  const totalValue = proposta.preco_total ?? summary.totalValue;
  const economiaMensal = proposta.economia_mensal ?? summary.savings?.monthly;
  const economiaAnual = economiaMensal != null ? economiaMensal * 12 : summary.savings?.yearly;
  const paybackAnos = proposta.payback_anos;
  const potencia = proposta.potencia_kwp ?? summary.system?.powerKwp;
  const geracaoMensal = proposta.geracao_mensal_kwh ?? summary.system?.monthlyGenKwh;
  const modules = proposta.modelo_modulo ?? summary.equipment?.modules;
  const inverter = proposta.modelo_inversor ?? summary.equipment?.inverter;
  const numModulos = proposta.numero_modulos;
  const linkPdf = proposta.link_pdf ?? summary.raw?.linkPdf;
  const downPayment = summary.downPayment;
  const installments = summary.installments;
  const displayDate = proposta.generated_at ?? proposta.created_at;

  const handleCopyResume = () => {
    const msg = formatProposalMessage({
      clienteNome: proposta.cliente_nome ?? undefined,
      totalValue: totalValue ?? undefined,
      downPayment,
      installmentsQty: installments?.qty,
      installmentsValue: installments?.value,
      modules: modules ?? undefined,
      inverter: inverter ?? undefined,
      economiaMensal: economiaMensal ?? undefined,
      linkPdf: linkPdf ?? undefined,
    });
    navigator.clipboard.writeText(msg);
    toast({ title: "Resumo copiado!" });
  };

  return (
    <Card
      className="group relative cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4"
      style={{
        borderLeftColor: proposta.status === "aceita"
          ? "hsl(var(--success))"
          : proposta.status === "recusada"
          ? "hsl(var(--destructive))"
          : "hsl(var(--primary))",
      }}
      onClick={() => onOpenDetail(proposta)}
    >
      <CardContent className="p-4 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">
              {proposta.cliente_nome || proposta.nome}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[proposta.cliente_cidade, proposta.cliente_estado]
                .filter(Boolean)
                .join(", ") || proposta.nome}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {priority && (
              <Badge className={`${priority.className} border-0 text-[10px] gap-1 px-1.5`}>
                <priority.icon className="h-3 w-3" />
                {priority.label}
              </Badge>
            )}
            <Badge className={`${status.color} border-0 text-[10px]`}>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* ── Hero: Valor + Economia ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
              <DollarSign className="h-3 w-3" />
              <span className="text-[10px] uppercase font-medium tracking-wider">Valor Total</span>
            </div>
            <p className="text-lg font-bold leading-tight">{fmtCurrency(totalValue)}</p>
            {downPayment != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Entrada {fmtCurrency(downPayment)}
                {installments?.qty && installments?.value
                  ? ` + ${installments.qty}x ${fmtCurrency(installments.value)}`
                  : ""}
              </p>
            )}
          </div>
          <div className="bg-success/5 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-success mb-0.5">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[10px] uppercase font-medium tracking-wider">Economia</span>
            </div>
            <p className="text-lg font-bold leading-tight text-success">
              {fmtCurrency(economiaMensal)}
              <span className="text-[10px] font-normal text-muted-foreground">/mês</span>
            </p>
            {economiaAnual != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fmtCurrency(economiaAnual)}/ano
              </p>
            )}
          </div>
        </div>

        {/* ── System ── */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-medium">{fmtNumber(potencia, "kWp")}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <SunMedium className="h-3 w-3 text-warning" />
            <span>{fmtNumber(geracaoMensal, "kWh/mês")}</span>
          </div>
          {paybackAnos != null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Payback {paybackAnos.toFixed(1)}a</span>
            </div>
          )}
        </div>

        {/* ── Equipment ── */}
        {(modules || inverter) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3 w-3 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              {[
                modules && `${numModulos ? `${numModulos}x ` : ""}${modules}`,
                inverter,
                summary.equipment?.batteries,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}

        {/* ── Footer: Actions ── */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onWhatsApp(proposta, summary);
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir no Inbox com resumo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyResume();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar resumo</TooltipContent>
          </Tooltip>

          {linkPdf && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a href={linkPdf} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver PDF</TooltipContent>
            </Tooltip>
          )}

          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(displayDate), "dd/MM/yy", { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
