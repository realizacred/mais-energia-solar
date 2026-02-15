import { useState } from "react";
import {
  Sun, Zap, DollarSign, Target, Clock, Phone, MapPin,
  FileText, Play, Pause, ChevronDown, ChevronRight,
  Image, StickyNote, ArrowUpRight, X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SolarZapConversation } from "./SolarZapConversationList";

interface Props {
  conversation: SolarZapConversation | null;
  onClose: () => void;
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
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between px-3 py-2 h-auto"
        >
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
          {/* Score */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Score de Atendimento</span>
              <span className={cn(
                "text-sm font-bold font-mono",
                score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive"
              )}>
                {score}/100
              </span>
            </div>
            <Progress
              value={score}
              className={cn(
                "h-2",
                score >= 70 ? "[&>div]:bg-success" : score >= 40 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"
              )}
            />
          </div>

          {/* SPIN Suggestions */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Sugestões SPIN
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md text-xs transition-colors",
                    s.done ? "bg-success/5 text-muted-foreground line-through" : "bg-muted/40 text-foreground"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    s.done ? "border-success bg-success" : "border-muted-foreground/30"
                  )}>
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

// Timeline demo data
const TIMELINE_EVENTS = [
  { id: "1", type: "stage", title: "Movido para 'Negociação'", time: "Hoje 14:30", icon: Target, color: "text-primary" },
  { id: "2", type: "call", title: "Chamada telefônica (3min)", time: "Hoje 11:20", icon: Phone, color: "text-info", hasAudio: true },
  { id: "3", type: "note", title: "Cliente interessado em financiamento", time: "Ontem 16:45", icon: StickyNote, color: "text-warning" },
  { id: "4", type: "stage", title: "Lead criado via WhatsApp", time: "12/02 09:10", icon: ArrowUpRight, color: "text-success" },
];

export function SolarZapContextPanel({ conversation, onClose }: Props) {
  if (!conversation) return null;

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
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Potência</p>
                <p className="text-sm font-bold font-mono text-foreground">5.4 <span className="text-[9px] font-normal">kWp</span></p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Valor</p>
                <p className="text-sm font-bold font-mono text-success">R$ 28k</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Etapa</p>
                <Badge className="text-[9px] px-1.5 bg-warning/10 text-warning border-warning/30 mt-0.5">
                  Negociação
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Coach */}
      <Separator className="bg-border/30" />
      <SolarAICoach />
      <Separator className="bg-border/30" />

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8">
          <TabsTrigger value="dados" className="text-xs h-6 px-2.5">Dados</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs h-6 px-2.5">Timeline</TabsTrigger>
          <TabsTrigger value="midia" className="text-xs h-6 px-2.5">Mídia</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Dados do Lead */}
          <TabsContent value="dados" className="p-3 space-y-3 mt-0">
            <InfoRow icon={Phone} label="Telefone" value={conversation.telefone} mono />
            <InfoRow icon={MapPin} label="Cidade" value="Juiz de Fora / MG" />
            <InfoRow icon={Zap} label="Consumo" value="450 kWh/mês" mono />
            <InfoRow icon={Sun} label="Telhado" value="Cerâmica" />
            <InfoRow icon={DollarSign} label="Conta" value="R$ 480,00" mono />
            <InfoRow icon={Clock} label="Criado" value="12/02/2026" mono />
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="p-3 mt-0">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />

              <div className="space-y-4">
                {TIMELINE_EVENTS.map((event) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="flex gap-3 relative">
                      <div className={cn(
                        "h-6 w-6 rounded-full bg-card border-2 border-border/50 flex items-center justify-center z-10 shrink-0",
                      )}>
                        <Icon className={cn("h-3 w-3", event.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{event.title}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{event.time}</p>
                        {event.hasAudio && (
                          <div className="mt-1.5 flex items-center gap-2 p-1.5 rounded-md bg-muted/40">
                            <Button size="icon" variant="ghost" className="h-6 w-6">
                              <Play className="h-3 w-3" />
                            </Button>
                            <div className="flex-1 h-1 rounded-full bg-muted-foreground/20">
                              <div className="h-full w-1/3 rounded-full bg-info" />
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground">3:12</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Mídia */}
          <TabsContent value="midia" className="p-3 mt-0">
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted/40 flex items-center justify-center border border-border/30">
                  <Image className="h-5 w-5 text-muted-foreground/30" />
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/20">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">Proposta_Solar_5.4kWp.pdf</p>
                  <p className="text-[10px] text-muted-foreground">245 KB</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
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
