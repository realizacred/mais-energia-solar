import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User, Phone, MapPin, Zap, ExternalLink,
  DollarSign, Target, Calendar, Clock,
  FileText, TrendingUp, X, Mail, CreditCard,
  Home, Sun, Building2, Ruler, Image,
  Link2, UserPlus, Sparkles,
} from "lucide-react";
import { WaContactEditor } from "./WaContactEditor";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui-kit/Spinner";
import type { WaConversation } from "@/hooks/useWaInbox";
import { formatBRLInteger } from "@/lib/formatters";

interface WaCRMSidebarProps {
  conversation: WaConversation;
  onClose: () => void;
  /** Open dialog to search & link an existing lead/cliente */
  onOpenLinkLead?: () => void;
  /** Create a new lead pre-filled with this conversation's phone */
  onCreateLead?: () => void;
  /** Create a new cliente pre-filled with this conversation's phone */
  onCreateCliente?: () => void;
  /** Quick-link to an existing lead found by phone (auto-suggestion) */
  onQuickLink?: (args: { leadId?: string | null; clienteId?: string | null }) => void;
}

export function WaCRMSidebar({ conversation, onClose, onOpenLinkLead, onCreateLead, onCreateCliente, onQuickLink }: WaCRMSidebarProps) {
  const leadId = conversation.lead_id;
  const clienteId = conversation.cliente_id;

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

  // Fetch cliente data
  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ["wa-crm-cliente", clienteId, leadId],
    queryFn: async () => {
      // Try by cliente_id first, then by lead_id
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, email, cpf_cnpj, rua, numero, bairro, cidade, estado, cep, complemento, potencia_kwp, numero_placas, modelo_inversor, valor_projeto, data_instalacao, observacoes, created_at, updated_at")
        .limit(1);

      if (clienteId) {
        query = query.eq("id", clienteId);
      } else if (leadId) {
        query = query.eq("lead_id", leadId);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId || !!leadId,
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

  // Fetch pipeline stages
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

  const isLoading = leadLoading || clienteLoading;
  const hasData = lead || cliente;

  // Estimated value
  const estimatedValue = cliente?.valor_projeto
    ? cliente.valor_projeto
    : lead?.consumo_previsto
    ? Math.round(lead.consumo_previsto * 0.15 * 5000)
    : null;

  const leadScore = lead ? calculateLeadScore(lead) : null;

  // Auto-suggest a lead/cliente by phone (when nothing is linked)
  const phoneDigits = (conversation.cliente_telefone || conversation.remote_jid || "")
    .replace(/\D/g, "")
    .slice(-11);
  const suggestionEnabled = !leadId && !clienteId && phoneDigits.length >= 10;
  const { data: suggestion } = useQuery({
    queryKey: ["wa-crm-suggest", phoneDigits],
    queryFn: async () => {
      const last10 = phoneDigits.slice(-10);
      const [{ data: leadsByPhone }, { data: clientesByPhone }] = await Promise.all([
        supabase
          .from("leads")
          .select("id, nome, telefone, lead_code")
          .ilike("telefone", `%${last10}%`)
          .limit(1),
        supabase
          .from("clientes")
          .select("id, nome, telefone, lead_id")
          .ilike("telefone", `%${last10}%`)
          .limit(1),
      ]);
      return {
        lead: leadsByPhone?.[0] || null,
        cliente: clientesByPhone?.[0] || null,
      };
    },
    enabled: suggestionEnabled,
    staleTime: 60 * 1000,
  });

  if (!leadId && !clienteId) {
    const sLead = suggestion?.lead;
    const sCliente = suggestion?.cliente;
    const hasSuggestion = !!(sLead || sCliente);

    return (
      <div className="w-full md:w-80 border-l border-border/40 bg-card/50 flex flex-col h-full min-h-0 overflow-hidden">
        <SidebarHeader onClose={onClose} />
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="text-center pt-2">
              <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-medium">Nenhum lead ou cliente vinculado</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Vincule, crie ou aceite a sugestão abaixo
              </p>
            </div>

            {hasSuggestion && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Encontramos um {sLead ? "lead" : "cliente"} com este telefone
                </div>
                <div className="text-xs text-foreground font-semibold truncate">
                  {(sLead?.nome || sCliente?.nome) ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {sLead?.telefone || sCliente?.telefone}
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5 mt-1"
                  onClick={() =>
                    onQuickLink?.({
                      leadId: sLead?.id ?? sCliente?.lead_id ?? null,
                      clienteId: sCliente?.id ?? null,
                    })
                  }
                  disabled={!onQuickLink}
                >
                  <Link2 className="h-3 w-3" />
                  Vincular
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs gap-1.5"
                onClick={onOpenLinkLead}
                disabled={!onOpenLinkLead}
              >
                <Link2 className="h-3.5 w-3.5" />
                Vincular lead existente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs gap-1.5"
                onClick={onCreateLead}
                disabled={!onCreateLead}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs gap-1.5"
                onClick={onCreateCliente}
                disabled={!onCreateCliente}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar cliente
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 border-l border-border/40 bg-card/50 flex flex-col h-full min-h-0 overflow-hidden">
      <SidebarHeader onClose={onClose} />

      <Tabs defaultValue="dados" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8 grid grid-cols-2">
          <TabsTrigger value="dados" className="text-xs h-6 px-2.5">Dados</TabsTrigger>
          <TabsTrigger value="midia" className="text-xs h-6 px-2.5">Mídia</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="sm" />
              </div>
            ) : !hasData ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Dados não encontrados</div>
            ) : (
              <div className="p-3 space-y-3">
                {/* Contact header */}
                <ContactHeader lead={lead} cliente={cliente} conversation={conversation} />

                {/* Contact editor (roles, email, Google sync badge) */}
                <WaContactEditor phoneE164={conversation.cliente_telefone || ""} />

                {/* Score & Value */}
                <ScoreValueCards leadScore={leadScore} estimatedValue={estimatedValue} />

                {/* Pipeline status */}
                {lead && (lead as any).lead_statuses && (
                  <PipelineSection lead={lead} pipelineStages={pipelineStages} />
                )}

                <Separator className="bg-border/30" />

                {/* Cliente registration data */}
                {cliente && <ClienteDataSection cliente={cliente} />}

                {/* Energy data from lead */}
                {lead && <EnergyDataSection lead={lead} />}

                <Separator className="bg-border/30" />

                {/* System data from cliente */}
                {cliente && (cliente.potencia_kwp || cliente.numero_placas || cliente.modelo_inversor) && (
                  <SystemDataSection cliente={cliente} />
                )}

                {/* Timestamps */}
                <TimestampsSection lead={lead} cliente={cliente} />

                <Separator className="bg-border/30" />

                {/* Orcamentos */}
                <OrcamentosSection orcamentos={orcamentos} />

                {/* Observations */}
                {(lead?.observacoes || cliente?.observacoes) && (
                  <>
                    <Separator className="bg-border/30" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Notas</p>
                      <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                        {cliente?.observacoes || lead?.observacoes}
                      </p>
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
        </TabsContent>

        <TabsContent value="midia" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              <MediaSection conversationId={conversation.id} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Sun className="h-3.5 w-3.5 text-warning" />
        Dados Comerciais
      </h3>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ContactHeader({ lead, cliente, conversation }: { lead: any; cliente: any; conversation: WaConversation }) {
  const name = cliente?.nome || lead?.nome || conversation.cliente_nome;
  const phone = cliente?.telefone || lead?.telefone || conversation.cliente_telefone;
  const city = cliente?.cidade || lead?.cidade;
  const state = cliente?.estado || lead?.estado;
  const email = cliente?.email;
  const cpf = cliente?.cpf_cnpj;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-sm font-semibold text-foreground truncate flex-1">{name}</h4>
        {lead?.lead_code && (
          <Badge variant="outline" className="font-mono text-[9px] px-1 shrink-0">{lead.lead_code}</Badge>
        )}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Phone className="h-2.5 w-2.5 shrink-0" />
          <span>{phone}</span>
        </div>
        {email && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Mail className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        )}
        {cpf && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <CreditCard className="h-2.5 w-2.5 shrink-0" />
            <span>{cpf}</span>
          </div>
        )}
        {city && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span>{city}{state ? `/${state}` : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreValueCards({ leadScore, estimatedValue }: { leadScore: number | null; estimatedValue: number | null }) {
  if (!leadScore && !estimatedValue) return null;
  return (
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
            <span className="text-[9px] text-muted-foreground font-medium">Valor</span>
          </div>
          <span className="text-sm font-bold text-foreground">
            {formatBRLInteger(estimatedValue)}
          </span>
        </div>
      )}
    </div>
  );
}

function PipelineSection({ lead, pipelineStages }: { lead: any; pipelineStages: any[] }) {
  return (
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
  );
}

function ClienteDataSection({ cliente }: { cliente: any }) {
  const hasAddress = cliente.rua || cliente.bairro || cliente.cep;
  if (!hasAddress && !cliente.cpf_cnpj) return null;

  const addressParts = [
    cliente.rua && `${cliente.rua}${cliente.numero ? `, ${cliente.numero}` : ""}`,
    cliente.complemento,
    cliente.bairro,
    cliente.cep,
  ].filter(Boolean);

  return (
    <>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1">
          <Home className="h-3 w-3" />
          Cadastro do Cliente
        </p>
        {addressParts.length > 0 && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {addressParts.join(" · ")}
          </p>
        )}
        {cliente.data_instalacao && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
            <Calendar className="h-2.5 w-2.5" />
            <span>Instalação: {format(new Date(cliente.data_instalacao), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}
      </div>
      <Separator className="bg-border/30" />
    </>
  );
}

function EnergyDataSection({ lead }: { lead: any }) {
  if (!lead.media_consumo && !lead.consumo_previsto) return null;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1">
        <Zap className="h-3 w-3 text-warning" />
        Consumo de Energia
      </p>
      <div className="grid grid-cols-2 gap-2">
        {lead.media_consumo > 0 && (
          <div className="p-1.5 rounded bg-warning/5 border border-warning/10 text-center">
            <p className="text-[9px] text-muted-foreground">Média</p>
            <p className="text-xs font-bold text-foreground">{lead.media_consumo} <span className="text-[9px] font-normal">kWh</span></p>
          </div>
        )}
        {lead.consumo_previsto > 0 && (
          <div className="p-1.5 rounded bg-warning/5 border border-warning/10 text-center">
            <p className="text-[9px] text-muted-foreground">Previsto</p>
            <p className="text-xs font-bold text-foreground">{lead.consumo_previsto} <span className="text-[9px] font-normal">kWh</span></p>
          </div>
        )}
      </div>
      {lead.tipo_telhado && lead.tipo_telhado !== "N/A" && (
        <p className="text-[10px] text-muted-foreground mt-1">🏠 {lead.tipo_telhado} · {lead.rede_atendimento}</p>
      )}
    </div>
  );
}

function SystemDataSection({ cliente }: { cliente: any }) {
  return (
    <>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1">
          <Sun className="h-3 w-3 text-warning" />
          Sistema Solar
        </p>
        <div className="grid grid-cols-2 gap-2">
          {cliente.potencia_kwp && (
            <div className="p-1.5 rounded bg-success/5 border border-success/10 text-center">
              <p className="text-[9px] text-muted-foreground">Potência</p>
              <p className="text-xs font-bold text-foreground">{cliente.potencia_kwp} <span className="text-[9px] font-normal">kWp</span></p>
            </div>
          )}
          {cliente.numero_placas && (
            <div className="p-1.5 rounded bg-success/5 border border-success/10 text-center">
              <p className="text-[9px] text-muted-foreground">Placas</p>
              <p className="text-xs font-bold text-foreground">{cliente.numero_placas}</p>
            </div>
          )}
        </div>
        {cliente.modelo_inversor && (
          <p className="text-[10px] text-muted-foreground mt-1">⚡ Inversor: {cliente.modelo_inversor}</p>
        )}
      </div>
      <Separator className="bg-border/30" />
    </>
  );
}

function TimestampsSection({ lead, cliente }: { lead: any; cliente: any }) {
  const source = cliente || lead;
  if (!source) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Calendar className="h-2.5 w-2.5" />
        <span>Criado: {format(new Date(source.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        <span>Atualizado: {format(new Date(source.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
      </div>
      {lead?.consultor && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
          <span>Consultor: {lead.consultor}</span>
        </div>
      )}
    </div>
  );
}

function OrcamentosSection({ orcamentos }: { orcamentos: any[] }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1">
        <FileText className="h-3 w-3" />
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

// ── MediaSection ──

function MediaSection({ conversationId }: { conversationId: string }) {
  const { data: mediaMessages, isLoading } = useQuery({
    queryKey: ["wa-crm-media", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_messages")
        .select("id, media_url, media_mime_type, message_type, content, created_at")
        .eq("conversation_id", conversationId)
        .in("message_type", ["image", "document", "video"])
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  const images = mediaMessages?.filter((m) => m.message_type === "image") || [];
  const documents = mediaMessages?.filter((m) => m.message_type === "document") || [];

  return (
    <>
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((m) => (
            <div key={m.id} className="aspect-square rounded-lg overflow-hidden border border-border/30">
              {m.media_url ? (
                <img src={m.media_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Image className="h-6 w-6 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Nenhuma mídia compartilhada</p>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Documentos</p>
          {documents.map((m) => (
            <a
              key={m.id}
              href={m.media_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{m.content || "Documento"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
