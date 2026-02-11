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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SunMedium className="h-5 w-5 text-primary" />
            {proposta.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Badge className={`${statusInfo.color} border-0`}>{statusInfo.label}</Badge>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Alterar:</Label>
              <Select
                value={proposta.status}
                onValueChange={(v) => onStatusChange(proposta.id, v)}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
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
          </div>

          {/* Cliente */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cliente
            </p>
            <p className="font-medium">{proposta.cliente_nome || "—"}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {proposta.cliente_celular && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {proposta.cliente_celular}
                </div>
              )}
              {proposta.cliente_email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {proposta.cliente_email}
                </div>
              )}
              {(proposta.cliente_cidade || proposta.cliente_estado) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[proposta.cliente_cidade, proposta.cliente_estado].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Sistema */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Zap className="h-3.5 w-3.5" />
                Potência
              </div>
              <p className="font-bold text-lg">
                {proposta.potencia_kwp ? `${proposta.potencia_kwp} kWp` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {proposta.numero_modulos ? `${proposta.numero_modulos} módulos` : ""}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Investimento
              </div>
              <p className="font-bold text-lg">{formatCurrency(proposta.preco_total)}</p>
              {proposta.payback_anos && (
                <p className="text-xs text-muted-foreground">
                  Payback: {proposta.payback_anos.toFixed(1)} anos
                </p>
              )}
            </div>
          </div>

          {/* Detalhes técnicos */}
          <div className="border rounded-lg p-3 space-y-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detalhes Técnicos
            </p>
            <div className="grid grid-cols-2 gap-y-1.5">
              <span className="text-muted-foreground">Módulo</span>
              <span className="font-medium">{proposta.modelo_modulo || "—"}</span>
              <span className="text-muted-foreground">Inversor</span>
              <span className="font-medium">{proposta.modelo_inversor || "—"}</span>
              <span className="text-muted-foreground">Geração/mês</span>
              <span className="font-medium">
                {proposta.geracao_mensal_kwh ? `${proposta.geracao_mensal_kwh} kWh` : "—"}
              </span>
              <span className="text-muted-foreground">Economia/mês</span>
              <span className="font-medium">{formatCurrency(proposta.economia_mensal)}</span>
              <span className="text-muted-foreground">Distribuidora</span>
              <span className="font-medium">{proposta.distribuidora || "—"}</span>
              <span className="text-muted-foreground">Consultor</span>
              <span className="font-medium">{proposta.vendedor?.nome || "—"}</span>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Criada em{" "}
              {format(new Date(proposta.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </div>
            {proposta.link_pdf && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" asChild>
                <a href={proposta.link_pdf} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
