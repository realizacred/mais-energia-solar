import { useState } from "react";
import {
  Sun, Zap, DollarSign, Target, Clock, Phone, MapPin,
  FileText, Play, Pause, ChevronDown, ChevronRight,
  Image, StickyNote, ArrowUpRight, X, Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { WaConversation } from "@/hooks/useWaInbox";

interface Props {
  conversation: WaConversation | null;
  onClose: () => void;
}

// Fetch deal/lead data linked to this conversation
function useConversationContext(conversation: WaConversation | null) {
  // Fetch lead data
  const leadQuery = useQuery({
    queryKey: ["solarzap-lead", conversation?.lead_id, conversation?.cliente_telefone],
    queryFn: async () => {
      if (conversation?.lead_id) {
        const { data } = await supabase
          .from("leads")
          .select("id, nome, telefone, cidade, estado, media_consumo, tipo_telhado, rede_atendimento, created_at, consultor")
          .eq("id", conversation.lead_id)
          .single();
        return data;
      }
      // Fallback: search by phone
      if (conversation?.cliente_telefone) {
        const digits = conversation.cliente_telefone.replace(/\D/g, "");
        if (digits.length >= 10) {
          const { data } = await (supabase as any)
            .from("leads")
            .select("id, nome, telefone, cidade, estado, media_consumo, tipo_telhado, rede_atendimento, created_at, consultor")
            .ilike("telefone_normalized", `%${digits.slice(-10)}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data as any;
          return data;
        }
      }
      return null;
    },
    enabled: !!conversation,
    staleTime: 60 * 1000,
  });

  // Fetch deal data linked to the lead via deals table
  const dealQuery = useQuery({
    queryKey: ["solarzap-deal", leadQuery.data?.id],
    queryFn: async () => {
      if (!leadQuery.data?.id) return null;
      // First find the deal linked to this lead
      const { data: dealRow } = await supabase
        .from("deals" as any)
        .select("id")
        .eq("lead_id", leadQuery.data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!dealRow) return null;
      // Then get the projection
      const { data } = await supabase
        .from("deal_kanban_projection")
        .select("deal_id, deal_value, deal_kwp, stage_name, owner_name, last_stage_change")
        .eq("deal_id", (dealRow as any).id)
        .maybeSingle();
      return data;
    },
    enabled: !!leadQuery.data?.id,
    staleTime: 60 * 1000,
  });

  // Fetch cliente data
  const clienteQuery = useQuery({
    queryKey: ["solarzap-cliente", conversation?.cliente_id],
    queryFn: async () => {
      if (!conversation?.cliente_id) return null;
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, cidade, estado, potencia_kwp, valor_projeto")
        .eq("id", conversation.cliente_id)
        .single();
      return data;
    },
    enabled: !!conversation?.cliente_id,
    staleTime: 60 * 1000,
  });

  return {
    lead: leadQuery.data,
    deal: dealQuery.data,
    cliente: clienteQuery.data,
    loading: leadQuery.isLoading || dealQuery.isLoading,
  };
}

// Solar AI Coach collapsible component
function SolarAICoach() {
  const [open, setOpen] = useState(true);
  const score = 72;
  const suggestions = [
    { id: "1", text: "Pergunte sobre o valor da conta de luz mensal", done: true },
    { id: "2", text: "Identifique o tipo de telhado (cerâmica, metálico, laje)", done: false },
    { id: "3", text: "Questione sobre disponibilidade para visita técnica", done: false },
    { id: "4", text: "Mencione as opções de financiamento disponíveis", done: false },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between px-3 py-2 h-auto">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold">Solar AI Coach</span>
          </div>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Score de Atendimento</span>
              <span className={cn("text-sm font-bold font-mono", score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive")}>
                {score}/100
              </span>
            </div>
            <Progress
              value={score}
              className={cn("h-2", score >= 70 ? "[&>div]:bg-success" : score >= 40 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive")}
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Sugestões SPIN</p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md text-xs transition-colors",
                    s.done ? "bg-success/5 text-muted-foreground line-through" : "bg-muted/40 text-foreground"
                  )}
                >
                  <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", s.done ? "border-success bg-success" : "border-muted-foreground/30")}>
                    {s.done && <span className="text-[8px] text-success-foreground">✓</span>}
                  </div>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SolarZapContextPanel({ conversation, onClose }: Props) {
  const { lead, deal, cliente, loading } = useConversationContext(conversation);

  if (!conversation) return null;

  const kwp = deal?.deal_kwp || cliente?.potencia_kwp || null;
  const valor = deal?.deal_value || cliente?.valor_projeto || null;
  const stageName = deal?.stage_name || null;
  const stageColor: string | null = null; // projection doesn't have color, use default

  return (
    <div className="w-80 border-l border-border/50 bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-warning" />
          Contexto Solar
        </h3>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Technical Summary Card */}
      <div className="p-3">
        {loading ? (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-2 w-12 mx-auto mb-1.5" />
                    <Skeleton className="h-5 w-10 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Potência</p>
                  <p className="text-sm font-bold font-mono text-foreground">
                    {kwp ? <>{kwp} <span className="text-[9px] font-normal">kWp</span></> : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Valor</p>
                  <p className="text-sm font-bold font-mono text-success">
                    {valor ? `R$ ${(valor / 1000).toFixed(0)}k` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Etapa</p>
                  {stageName ? (
                    <Badge
                      className="text-[9px] px-1.5 mt-0.5"
                      style={stageColor ? { backgroundColor: `${stageColor}20`, color: stageColor, borderColor: `${stageColor}50` } : undefined}
                    >
                      {stageName}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Coach */}
      <Separator className="bg-border/30" />
      <SolarAICoach />
      <Separator className="bg-border/30" />

      {/* Tabs */}
      <Tabs defaultValue="dados" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8">
          <TabsTrigger value="dados" className="text-xs h-6 px-2.5">Dados</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs h-6 px-2.5">Timeline</TabsTrigger>
          <TabsTrigger value="midia" className="text-xs h-6 px-2.5">Mídia</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Dados do Lead */}
          <TabsContent value="dados" className="p-3 space-y-3 mt-0">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <>
                <InfoRow icon={Phone} label="Telefone" value={conversation.cliente_telefone || "—"} mono />
                <InfoRow icon={MapPin} label="Cidade" value={lead?.cidade && lead?.estado ? `${lead.cidade} / ${lead.estado}` : cliente?.cidade || "—"} />
                <InfoRow icon={Zap} label="Consumo" value={lead?.media_consumo ? `${lead.media_consumo} kWh/mês` : "—"} mono />
                <InfoRow icon={Sun} label="Telhado" value={lead?.tipo_telhado || "—"} />
                <InfoRow icon={DollarSign} label="Valor" value={valor ? `R$ ${valor.toLocaleString("pt-BR")}` : "—"} mono />
                <InfoRow icon={Clock} label="Criado" value={conversation.created_at ? new Date(conversation.created_at).toLocaleDateString("pt-BR") : "—"} mono />
                {deal?.owner_name && <InfoRow icon={Target} label="Responsável" value={deal.owner_name} />}
                {lead?.consultor && <InfoRow icon={Target} label="Consultor" value={lead.consultor} />}
              </>
            )}
          </TabsContent>

          {/* Timeline - still uses demo data as a placeholder until timeline events table exists */}
          <TabsContent value="timeline" className="p-3 mt-0">
            <TimelineSection conversationId={conversation.id} />
          </TabsContent>

          {/* Mídia */}
          <TabsContent value="midia" className="p-3 mt-0">
            <MediaSection conversationId={conversation.id} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// Timeline fetches real deal stage history
function TimelineSection({ conversationId }: { conversationId: string }) {
  // For now show a meaningful empty state - real timeline requires deal_stage_history link
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Clock className="h-6 w-6 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">Timeline será populada com</p>
      <p className="text-xs text-muted-foreground">histórico de etapas e atividades</p>
    </div>
  );
}

// Media section fetches real media messages
function MediaSection({ conversationId }: { conversationId: string }) {
  const { data: mediaMessages, isLoading } = useQuery({
    queryKey: ["solarzap-media", conversationId],
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
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted/40 flex items-center justify-center border border-border/30">
              <Image className="h-5 w-5 text-muted-foreground/30" />
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-3 space-y-1.5">
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
                  {new Date(m.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <span className={cn("text-xs text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}
