import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Calendar,
  SunMedium,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Proposta } from "@/hooks/usePropostas";
import { formatBRLInteger } from "@/lib/formatters";

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho", color: "bg-muted text-muted-foreground" },
  { value: "enviada", label: "Enviada", color: "bg-info/15 text-info" },
  { value: "visualizada", label: "Visualizada", color: "bg-warning/15 text-warning" },
  { value: "aceita", label: "Aceita", color: "bg-success/15 text-success" },
  { value: "recusada", label: "Recusada", color: "bg-destructive/15 text-destructive" },
  { value: "expirada", label: "Expirada", color: "bg-muted text-muted-foreground" },
];

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return formatBRLInteger(value);
}

interface PropostaDetailDialogProps {
  proposta: Proposta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function PropostaDetailDialog({
  proposta,
  open,
  onOpenChange,
  onStatusChange,
}: PropostaDetailDialogProps) {
  if (!proposta) return null;

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === proposta.status) || STATUS_OPTIONS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <SunMedium className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold text-foreground truncate">
              {proposta.nome}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Detalhes da proposta comercial</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
            {proposta.link_pdf && (
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" asChild>
                <a href={proposta.link_pdf} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver PDF
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body — 2 columns */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* IDENTIFICAÇÃO */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</p>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium text-foreground">{proposta.cliente_nome || "—"}</span>
                  <span className="text-muted-foreground">Telefone</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    {proposta.cliente_celular ? (
                      <><Phone className="h-3.5 w-3.5 text-muted-foreground" />{proposta.cliente_celular}</>
                    ) : "—"}
                  </span>
                  <span className="text-muted-foreground">E-mail</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    {proposta.cliente_email ? (
                      <><Mail className="h-3.5 w-3.5 text-muted-foreground" />{proposta.cliente_email}</>
                    ) : "—"}
                  </span>
                  <span className="text-muted-foreground">Localização</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    {(proposta.cliente_cidade || proposta.cliente_estado) ? (
                      <><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{[proposta.cliente_cidade, proposta.cliente_estado].filter(Boolean).join(", ")}</>
                    ) : "—"}
                  </span>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* SISTEMA */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sistema Fotovoltaico</p>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Potência</span>
                  <span className="font-medium text-foreground">
                    {proposta.potencia_kwp ? `${proposta.potencia_kwp} kWp` : "—"}
                  </span>
                  <span className="text-muted-foreground">Nº Módulos</span>
                  <span className="font-medium text-foreground">
                    {proposta.numero_modulos || "—"}
                  </span>
                  <span className="text-muted-foreground">Módulo</span>
                  <span className="font-medium text-foreground">{proposta.modelo_modulo || "—"}</span>
                  <span className="text-muted-foreground">Inversor</span>
                  <span className="font-medium text-foreground">{proposta.modelo_inversor || "—"}</span>
                  <span className="text-muted-foreground">Geração/mês</span>
                  <span className="font-medium text-foreground">
                    {proposta.geracao_mensal_kwh ? `${proposta.geracao_mensal_kwh} kWh` : "—"}
                  </span>
                  <span className="text-muted-foreground">Distribuidora</span>
                  <span className="font-medium text-foreground">{proposta.distribuidora || "—"}</span>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* FINANCEIRO */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="text-[10px] uppercase font-medium tracking-wider">Valor Total</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(proposta.preco_total)}</p>
                  </div>
                  <div className="bg-success/5 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-success mb-1">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="text-[10px] uppercase font-medium tracking-wider">Economia/mês</span>
                    </div>
                    <p className="text-xl font-bold text-success">{formatCurrency(proposta.economia_mensal)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Payback</span>
                  <span className="font-medium text-foreground">
                    {proposta.payback_anos ? `${proposta.payback_anos.toFixed(1)} anos` : "—"}
                  </span>
                  <span className="text-muted-foreground">Consultor</span>
                  <span className="font-medium text-foreground">{proposta.vendedor?.nome || "—"}</span>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* STATUS & HISTÓRICO */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status & Histórico</p>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground shrink-0">Alterar status:</Label>
                  <Select
                    value={proposta.status}
                    onValueChange={(v) => onStatusChange(proposta.id, v)}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Criada em</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(proposta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <span className="text-muted-foreground">Gerada em</span>
                  <span className="font-medium text-foreground">
                    {proposta.generated_at
                      ? format(new Date(proposta.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
