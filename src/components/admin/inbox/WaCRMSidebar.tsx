import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User, Phone, MapPin, Zap, ExternalLink,
  DollarSign, Target, Calendar, Clock, Plus, ArrowRight,
  FileText, TrendingUp, X, ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui-kit/Spinner";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaCRMSidebarProps {
  conversation: WaConversation;
  onClose: () => void;
}

export function WaCRMSidebar({ conversation, onClose }: WaCRMSidebarProps) {
  const leadId = conversation.lead_id;

  // Fetch lead with pipeline status
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["wa-crm-lead", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_code, nome, telefone, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, observacoes, status_id, consultor, created_at, updated_at, lead_statuses(nome, cor, ordem)")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });

  // Fetch orcamentos for this lead
  const { data: orcamentos = [] } = useQuery({
    queryKey: ["wa-crm-orcamentos", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, orc_code, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });

  // Fetch pipeline stages for context
  const { data: pipelineStages = [] } = useQuery<Array<{ id: string; nome: string; cor: string; ordem: number }>>({
    queryKey: ["wa-crm-pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_statuses")
        .select("id, nome, cor, ordem")
        .order("ordem");
      if (error) throw error;
      return (data || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Estimated value (simple calculation based on consumption)
  const estimatedValue = lead?.consumo_previsto
    ? Math.round(lead.consumo_previsto * 0.15 * 5000) // rough kWp * R$/kWp
    : null;

  const leadScore = lead ? calculateLeadScore(lead) : null;

  if (!leadId) {
    return (
      <div className="w-72 border-l border-border/40 bg-card/50 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
          <h3 className="text-xs font-semibold text-foreground">Dados Comerciais</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum lead vinculado</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Vincule um lead para ver dados comerciais</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-border/40 bg-card/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <h3 className="text-xs font-semibold text-foreground">Dados Comerciais</h3>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {leadLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="sm" />
          </div>
        ) : !lead ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Lead não encontrado</div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Lead header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground truncate flex-1">{lead.nome}</h4>
                {lead.lead_code && (
                  <Badge variant="outline" className="font-mono text-[9px] px-1 shrink-0">{lead.lead_code}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Phone className="h-2.5 w-2.5" />
                <span>{lead.telefone}</span>
                {lead.cidade && (
                  <>
                    <span>·</span>
                    <MapPin className="h-2.5 w-2.5" />
                    <span>{lead.cidade}/{lead.estado}</span>
                  </>
                )}
              </div>
            </div>

            {/* Score & Value cards */}
            <div className="grid grid-cols-2 gap-2">
              {leadScore !== null && (
                <div className="p-2 rounded-lg bg-muted/40 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <span className="text-[9px] text-muted-foreground font-medium">Score</span>
                  </div>
                  <span className={`text-lg font-bold ${
                    leadScore >= 70 ? "text-success" : leadScore >= 40 ? "text-warning" : "text-destructive"
                  }`}>
                    {leadScore}
                  </span>
                </div>
              )}
              {estimatedValue && (
                <div className="p-2 rounded-lg bg-muted/40 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <DollarSign className="h-3 w-3 text-success" />
                    <span className="text-[9px] text-muted-foreground font-medium">Estimado</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(estimatedValue)}
                  </span>
                </div>
              )}
            </div>

            {/* Pipeline status */}
            {(lead as any).lead_statuses && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">Funil</p>
                <div className="flex gap-0.5">
                  {pipelineStages.map((stage) => {
                    const isActive = stage.id === lead.status_id;
                    const isPast = stage.ordem < ((lead as any).lead_statuses?.ordem || 0);
                    return (
                      <div
                        key={stage.id}
                        className="flex-1 h-1.5 rounded-full transition-colors"
                        style={{
                          backgroundColor: isActive
                            ? stage.cor
                            : isPast
                            ? stage.cor + "60"
                            : "hsl(var(--muted))",
                        }}
                        title={stage.nome}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    className="text-[9px] px-1.5 py-0"
                    style={{
                      backgroundColor: (lead as any).lead_statuses.cor + "20",
                      color: (lead as any).lead_statuses.cor,
                      borderColor: (lead as any).lead_statuses.cor + "40",
                    }}
                  >
                    {(lead as any).lead_statuses.nome}
                  </Badge>
                </div>
              </div>
            )}

            <Separator className="bg-border/30" />

            {/* Energy data */}
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">Consumo</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-1.5 rounded bg-primary/5 text-center">
                  <p className="text-[9px] text-muted-foreground">Média</p>
                  <p className="text-xs font-bold text-foreground">{lead.media_consumo} <span className="text-[9px] font-normal">kWh</span></p>
                </div>
                <div className="p-1.5 rounded bg-primary/5 text-center">
                  <p className="text-[9px] text-muted-foreground">Previsto</p>
                  <p className="text-xs font-bold text-foreground">{lead.consumo_previsto} <span className="text-[9px] font-normal">kWh</span></p>
                </div>
              </div>
              {lead.tipo_telhado && lead.tipo_telhado !== "N/A" && (
                <p className="text-[10px] text-muted-foreground mt-1">🏠 {lead.tipo_telhado} · {lead.rede_atendimento}</p>
              )}
            </div>

            <Separator className="bg-border/30" />

            {/* Timestamps */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                <span>Criado: {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span>Atualizado: {format(new Date(lead.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
            {lead.consultor && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <User className="h-2.5 w-2.5" />
                  <span>Consultor: {lead.consultor}</span>
                </div>
              )}
            </div>

            <Separator className="bg-border/30" />

            {/* Orcamentos */}
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">
                Orçamentos ({orcamentos.length})
              </p>
              {orcamentos.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60">Nenhum orçamento</p>
              ) : (
                <div className="space-y-1.5">
                  {orcamentos.slice(0, 5).map((orc) => (
                    <div key={orc.id} className="p-2 rounded-lg bg-muted/30 border border-border/20">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono text-[9px] px-1">{orc.orc_code || "—"}</Badge>
                        <span className="text-[9px] text-muted-foreground">
                          {format(new Date(orc.created_at), "dd/MM/yy")}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {orc.consumo_previsto} kWh · {orc.cidade}/{orc.estado}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observations */}
            {lead.observacoes && (
              <>
                <Separator className="bg-border/30" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Notas</p>
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{lead.observacoes}</p>
                </div>
              </>
            )}

            {/* Open in admin */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs gap-1.5 mt-2"
              onClick={() => window.open(`/admin?tab=leads`, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir no Admin
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/** Simple lead scoring based on available data completeness and quality */
function calculateLeadScore(lead: any): number {
  let score = 0;
  if (lead.nome) score += 10;
  if (lead.telefone) score += 10;
  if (lead.estado && lead.estado !== "N/A") score += 10;
  if (lead.cidade && lead.cidade !== "N/A") score += 10;
  if (lead.media_consumo && lead.media_consumo > 0) score += 15;
  if (lead.consumo_previsto && lead.consumo_previsto > 0) score += 15;
  if (lead.tipo_telhado && lead.tipo_telhado !== "N/A") score += 10;
  if (lead.rede_atendimento && lead.rede_atendimento !== "N/A") score += 10;
  if (lead.observacoes) score += 5;
  if (lead.status_id) score += 5;
  return Math.min(score, 100);
}
