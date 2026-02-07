 import { useState, useEffect } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Progress } from "@/components/ui/progress";
 import { 
   Sparkles, 
   Flame, 
   ThermometerSun, 
   Snowflake,
   RefreshCw,
   MessageCircle,
   ChevronDown,
   ChevronUp,
   Loader2
 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import type { Lead } from "@/types/lead";
 import { cn } from "@/lib/utils";
 import { ScheduleWhatsAppDialog } from "../ScheduleWhatsAppDialog";
 
 interface ScoreResult {
   lead_id: string;
   score: number;
   level: "hot" | "warm" | "cold";
   factors: string[];
   recommendation: string;
 }
 
 interface LeadScoringProps {
   leads: Lead[];
   statuses: { id: string; nome: string; cor: string }[];
   onSelectLead?: (lead: Lead) => void;
 }
 
 export function LeadScoring({ leads, statuses, onSelectLead }: LeadScoringProps) {
   const [scores, setScores] = useState<Map<string, ScoreResult>>(new Map());
   const [loading, setLoading] = useState(false);
   const [expanded, setExpanded] = useState(true);
   const [lastScored, setLastScored] = useState<Date | null>(null);
 
   // Load cached scores
   useEffect(() => {
     const cached = localStorage.getItem("lead_scores_cache");
     if (cached) {
       try {
         const { scores: cachedScores, timestamp } = JSON.parse(cached);
         const map = new Map<string, ScoreResult>();
         cachedScores.forEach((s: ScoreResult) => map.set(s.lead_id, s));
         setScores(map);
         setLastScored(new Date(timestamp));
       } catch (e) {
         console.error("Failed to parse cached scores:", e);
       }
     }
   }, []);
 
   const runScoring = async () => {
     if (leads.length === 0) {
       toast({ title: "Nenhum lead para analisar" });
       return;
     }
 
     setLoading(true);
 
     try {
       // Prepare lead data with status names
       const leadsWithStatus = leads.map((lead) => ({
         ...lead,
         status_nome: statuses.find((s) => s.id === lead.status_id)?.nome || "Novo",
       }));
 
       const { data, error } = await supabase.functions.invoke("lead-scoring", {
         body: { leads: leadsWithStatus.slice(0, 50) }, // Limit to 50 leads
       });
 
       if (error) throw error;
 
       const newScores = new Map<string, ScoreResult>();
       (data.scores || []).forEach((score: ScoreResult) => {
         newScores.set(score.lead_id, score);
       });
 
       setScores(newScores);
       setLastScored(new Date());
 
       // Cache results
       localStorage.setItem(
         "lead_scores_cache",
         JSON.stringify({
           scores: data.scores,
           timestamp: new Date().toISOString(),
         })
       );
 
       toast({
         title: "Análise concluída!",
         description: `${data.scores?.length || 0} leads analisados com IA.`,
       });
     } catch (error) {
       console.error("Scoring error:", error);
       toast({
         title: "Erro na análise",
         description: "Não foi possível analisar os leads. Tente novamente.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
   const getLevelIcon = (level: ScoreResult["level"]) => {
     switch (level) {
       case "hot":
         return <Flame className="h-4 w-4 text-orange-500" />;
       case "warm":
         return <ThermometerSun className="h-4 w-4 text-yellow-500" />;
       case "cold":
         return <Snowflake className="h-4 w-4 text-blue-400" />;
     }
   };
 
   const getLevelBadge = (level: ScoreResult["level"]) => {
     switch (level) {
       case "hot":
         return (
           <Badge className="bg-orange-100 text-orange-700 border-orange-200">
             🔥 Quente
           </Badge>
         );
       case "warm":
         return (
           <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
             ☀️ Morno
           </Badge>
         );
       case "cold":
         return (
           <Badge className="bg-blue-100 text-blue-700 border-blue-200">
             ❄️ Frio
           </Badge>
         );
     }
   };
 
   const getScoreColor = (score: number) => {
     if (score >= 70) return "bg-orange-500";
     if (score >= 40) return "bg-yellow-500";
     return "bg-blue-400";
   };
 
   // Get top scored leads
   const scoredLeads = leads
     .map((lead) => ({ lead, score: scores.get(lead.id) }))
     .filter((item) => item.score)
     .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0));
 
   const hotLeads = scoredLeads.filter((s) => s.score?.level === "hot");
   const warmLeads = scoredLeads.filter((s) => s.score?.level === "warm");
   const coldLeads = scoredLeads.filter((s) => s.score?.level === "cold");
 
  const [whatsappDialogLead, setWhatsappDialogLead] = useState<Lead | null>(null);

  const openWhatsAppDialog = (lead: Lead) => {
    setWhatsappDialogLead(lead);
  };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-primary" />
             <CardTitle className="text-base">Scoring de Leads (IA)</CardTitle>
             {scores.size > 0 && (
               <Badge variant="secondary">{scores.size} analisados</Badge>
             )}
           </div>
           <div className="flex items-center gap-2">
             <Button
               size="sm"
               onClick={runScoring}
               disabled={loading}
               className="gap-1"
             >
               {loading ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
               ) : (
                 <RefreshCw className="h-4 w-4" />
               )}
               {loading ? "Analisando..." : "Analisar"}
             </Button>
             <Button
               size="icon"
               variant="ghost"
               className="h-8 w-8"
               onClick={() => setExpanded(!expanded)}
             >
               {expanded ? (
                 <ChevronUp className="h-4 w-4" />
               ) : (
                 <ChevronDown className="h-4 w-4" />
               )}
             </Button>
           </div>
         </div>
         <CardDescription>
           Análise inteligente para priorizar seus melhores leads
           {lastScored && (
             <span className="text-xs ml-2">
               • Última análise: {lastScored.toLocaleTimeString("pt-BR")}
             </span>
           )}
         </CardDescription>
       </CardHeader>
 
       {expanded && (
         <CardContent>
           {scores.size === 0 ? (
             <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
               <Sparkles className="h-12 w-12 opacity-20 mb-2" />
               <p className="text-sm font-medium">Nenhuma análise realizada</p>
               <p className="text-xs mt-1">
                 Clique em "Analisar" para identificar seus melhores leads
               </p>
             </div>
           ) : (
             <div className="space-y-4">
               {/* Summary Stats */}
               <div className="grid grid-cols-3 gap-3">
                 <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-center">
                   <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                   <p className="text-2xl font-bold text-orange-600">{hotLeads.length}</p>
                   <p className="text-xs text-orange-600/80">Quentes</p>
                 </div>
                 <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-center">
                   <ThermometerSun className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                   <p className="text-2xl font-bold text-yellow-600">{warmLeads.length}</p>
                   <p className="text-xs text-yellow-600/80">Mornos</p>
                 </div>
                 <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                   <Snowflake className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                   <p className="text-2xl font-bold text-blue-500">{coldLeads.length}</p>
                   <p className="text-xs text-blue-500/80">Frios</p>
                 </div>
               </div>
 
               {/* Top Leads */}
               {hotLeads.length > 0 && (
                 <div>
                   <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                     <Flame className="h-4 w-4 text-orange-500" />
                     Prioridade Máxima
                   </h4>
                   <div className="space-y-2">
                     {hotLeads.slice(0, 5).map(({ lead, score }) => (
                       <div
                         key={lead.id}
                         className="p-3 rounded-lg border bg-orange-50/50 border-orange-200/50"
                       >
                         <div className="flex items-start justify-between gap-2">
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                               <span className="font-medium text-sm truncate">
                                 {lead.nome}
                               </span>
                               {getLevelBadge(score!.level)}
                             </div>
                             <div className="flex items-center gap-2 mb-2">
                               <Progress
                                 value={score!.score}
                                 className={cn("h-2 flex-1", getScoreColor(score!.score))}
                               />
                               <span className="text-xs font-bold text-orange-600">
                                 {score!.score}
                               </span>
                             </div>
                             <p className="text-xs text-muted-foreground">
                               {score!.recommendation}
                             </p>
                             <div className="flex flex-wrap gap-1 mt-2">
                               {score!.factors.slice(0, 3).map((factor, i) => (
                                 <Badge
                                   key={i}
                                   variant="outline"
                                   className="text-xs py-0"
                                 >
                                   {factor}
                                 </Badge>
                               ))}
                             </div>
                           </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <Button
                                size="sm"
                                className="gap-1 h-8 bg-green-600 hover:bg-green-700"
                                onClick={() => openWhatsAppDialog(lead)}
                              >
                                <MessageCircle className="h-3 w-3" />
                                WhatsApp
                              </Button>
                             {onSelectLead && (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="h-8"
                                 onClick={() => onSelectLead(lead)}
                               >
                                 Ver mais
                               </Button>
                             )}
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
 
               {/* Warm Leads Summary */}
               {warmLeads.length > 0 && (
                 <div>
                   <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                     <ThermometerSun className="h-4 w-4 text-yellow-500" />
                     Acompanhar ({warmLeads.length})
                   </h4>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                     {warmLeads.slice(0, 6).map(({ lead, score }) => (
                       <div
                         key={lead.id}
                         className="p-2 rounded border bg-yellow-50/30 cursor-pointer hover:bg-yellow-50 transition-colors"
                         onClick={() => onSelectLead?.(lead)}
                       >
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-medium truncate">
                             {lead.nome.split(" ")[0]}
                           </span>
                           <span className="text-xs font-bold text-yellow-600">
                             {score!.score}
                           </span>
                         </div>
                         <Progress
                           value={score!.score}
                           className="h-1 mt-1"
                         />
                       </div>
                     ))}
                   </div>
                 </div>
               )}
              </div>
            )}
          </CardContent>
        )}

        <ScheduleWhatsAppDialog
          lead={whatsappDialogLead}
          open={!!whatsappDialogLead}
          onOpenChange={(open) => !open && setWhatsappDialogLead(null)}
        />
      </Card>
    );
  }