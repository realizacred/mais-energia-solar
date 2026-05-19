import { getProposalWebUrl } from "@/services/proposal/proposalLinks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, MessageCircle, Mail, Clock, Zap } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import type { PropostaConsultor } from "@/hooks/useMinhasPropostasConsultor";

interface ProposalCardProps {
  proposta: PropostaConsultor;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  gerada: { label: "Gerada", cls: "bg-muted text-muted-foreground" },
  enviada: { label: "Enviada", cls: "border-info/30 bg-info/10 text-info" },
  vista: { label: "Visualizada", cls: "border-warning/30 bg-warning/10 text-warning" },
  aceita: { label: "Aceita", cls: "border-success/30 bg-success/10 text-success" },
  expirada: { label: "Expirada", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  recusada: { label: "Recusada", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
};

const STATUS_DOT: Record<string, string> = {
  gerada: 'bg-muted-foreground',
  enviada: 'bg-info',
  vista: 'bg-warning',
  aceita: 'bg-success',
  expirada: 'bg-destructive',
  recusada: 'bg-destructive',
};

export function ProposalCard({ proposta }: ProposalCardProps) {
  const status = STATUS_CONFIG[proposta.status] || { label: proposta.status, cls: "" };
  const valDate = proposta.valido_ate ? new Date(proposta.valido_ate) : null;
  const visto = ["viewed", "vista"].includes(proposta.status) || ["accepted", "aceita"].includes(proposta.status) || (proposta.total_aberturas && proposta.total_aberturas > 0);

  return (
    <Card className={`${visto ? "bg-success/5" : ""} ${["accepted", "aceita"].includes(proposta.status) ? "bg-primary/5" : ""} shadow-sm overflow-hidden`}>

      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Checkbox checked={!!visto} disabled className="mt-0.5" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate text-primary leading-tight">{proposta.cliente_nome}</h3>
              <div className="flex flex-col gap-0.5 mt-1">
                {proposta.titulo && proposta.titulo !== proposta.cliente_nome && (
                  <p className="text-[11px] text-muted-foreground truncate leading-tight" title={proposta.titulo}>
                    {proposta.titulo}
                  </p>
                )}
                {proposta.versao_numero && (
                  <span className="text-[10px] text-muted-foreground/60 font-medium leading-none">
                    Versão {proposta.versao_numero}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant="outline" className={`gap-1.5 h-6 px-2 text-[10px] ${status.cls}`}>
            <span className={`h-1 w-1 rounded-full ${STATUS_DOT[proposta.status] || 'bg-muted-foreground'}`} />
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/50">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Proposta</p>
            <Badge variant="secondary" className="font-mono text-[10px] h-5">
              {proposta.codigo || `PROP-${proposta.proposta_num}`}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Potência</p>
            <p className="text-xs font-semibold flex items-center gap-1">
              <Zap className="h-3 w-3 text-warning" />
              {proposta.potencia_kwp != null ? `${Number(proposta.potencia_kwp).toFixed(2)} kWp` : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Valor</p>
            <p className="text-xs font-bold text-primary">
              {proposta.valor_total != null ? formatBRL(Number(proposta.valor_total)) : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Validade</p>
            <p className="text-xs flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {valDate ? valDate.toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5" onClick={() => window.open(getProposalWebUrl(proposta.public_token), '_blank')}>
            <ExternalLink className="h-3 w-3" /> Ver
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5 text-success border-success/30 hover:bg-success/5">
            <MessageCircle className="h-3 w-3" /> Zap
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5 text-info border-info/30 hover:bg-info/5">
            <Mail className="h-3 w-3" /> Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
