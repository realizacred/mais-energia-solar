import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutGrid, BarChart3, Settings2 } from "lucide-react";
import { subDays, isAfter } from "date-fns";
import { PipelineFilters, KanbanCard, PipelineAutomations, EnhancedFunnel } from "./pipeline";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";
 
 interface LeadStatus {
   id: string;
   nome: string;
   ordem: number;
   cor: string;
 }
 
 interface Lead {
   id: string;
   lead_code: string | null;
   nome: string;
   telefone: string;
   cidade: string;
   estado: string;
   media_consumo: number;
   vendedor: string | null;
   status_id: string | null;
   created_at: string;
   ultimo_contato?: string | null;
   visto?: boolean;
 }
 
 export default function LeadsPipeline() {
   const [statuses, setStatuses] = useState<LeadStatus[]>([]);
   const [leads, setLeads] = useState<Lead[]>([]);
   const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState("kanban");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedLeadForWhatsApp, setSelectedLeadForWhatsApp] = useState<Lead | null>(null);
 
   // Filter states
   const [searchTerm, setSearchTerm] = useState("");
   const [selectedVendedor, setSelectedVendedor] = useState("all");
   const [selectedEstado, setSelectedEstado] = useState("all");
   const [consumoRange, setConsumoRange] = useState("all");
   const [dateRange, setDateRange] = useState("all");
 
   const { toast } = useToast();
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const fetchData = async () => {
     try {
       const [statusRes, leadsRes] = await Promise.all([
         supabase.from("lead_status").select("*").order("ordem"),
         supabase.from("leads").select("id, lead_code, nome, telefone, cidade, estado, media_consumo, vendedor, status_id, created_at, ultimo_contato, visto").order("created_at", { ascending: false }),
       ]);
 
       if (statusRes.error) throw statusRes.error;
       if (leadsRes.error) throw leadsRes.error;
 
       setStatuses(statusRes.data || []);
       setLeads(leadsRes.data || []);
     } catch (error) {
       console.error("Erro ao buscar dados:", error);
       toast({
         title: "Erro",
         description: "Não foi possível carregar o pipeline.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
   // Extract unique vendedores and estados for filters
   const vendedores = useMemo(() => {
     const unique = [...new Set(leads.map((l) => l.vendedor).filter(Boolean))];
     return unique.map((nome) => ({ nome: nome as string }));
   }, [leads]);
 
   const estados = useMemo(() => {
     return [...new Set(leads.map((l) => l.estado))].sort();
   }, [leads]);
 
   // Filter leads
   const filteredLeads = useMemo(() => {
     return leads.filter((lead) => {
       if (searchTerm) {
         const search = searchTerm.toLowerCase();
         const matchesSearch =
           lead.nome.toLowerCase().includes(search) ||
           lead.telefone.includes(search) ||
           (lead.lead_code && lead.lead_code.toLowerCase().includes(search));
         if (!matchesSearch) return false;
       }
 
       if (selectedVendedor !== "all" && lead.vendedor !== selectedVendedor) return false;
       if (selectedEstado !== "all" && lead.estado !== selectedEstado) return false;
 
       if (consumoRange !== "all") {
         const consumo = lead.media_consumo;
         switch (consumoRange) {
           case "0-300": if (consumo > 300) return false; break;
           case "300-600": if (consumo <= 300 || consumo > 600) return false; break;
           case "600-1000": if (consumo <= 600 || consumo > 1000) return false; break;
           case "1000+": if (consumo <= 1000) return false; break;
         }
       }
 
       if (dateRange !== "all") {
         const createdAt = new Date(lead.created_at);
         const now = new Date();
         switch (dateRange) {
           case "today": if (!isAfter(createdAt, subDays(now, 1))) return false; break;
           case "7days": if (!isAfter(createdAt, subDays(now, 7))) return false; break;
           case "30days": if (!isAfter(createdAt, subDays(now, 30))) return false; break;
           case "90days": if (!isAfter(createdAt, subDays(now, 90))) return false; break;
         }
       }
 
       return true;
     });
   }, [leads, searchTerm, selectedVendedor, selectedEstado, consumoRange, dateRange]);
 
   const activeFiltersCount = useMemo(() => {
     let count = 0;
     if (selectedVendedor !== "all") count++;
     if (selectedEstado !== "all") count++;
     if (consumoRange !== "all") count++;
     if (dateRange !== "all") count++;
     return count;
   }, [selectedVendedor, selectedEstado, consumoRange, dateRange]);
 
   const clearFilters = () => {
     setSearchTerm("");
     setSelectedVendedor("all");
     setSelectedEstado("all");
     setConsumoRange("all");
     setDateRange("all");
   };
 
   const handleDragStart = (e: React.DragEvent, lead: Lead) => {
     setDraggedLead(lead);
     e.dataTransfer.effectAllowed = "move";
   };
 
   const handleDragOver = (e: React.DragEvent) => {
     e.preventDefault();
     e.dataTransfer.dropEffect = "move";
   };
 
   const handleDrop = async (e: React.DragEvent, statusId: string) => {
     e.preventDefault();
     if (!draggedLead || draggedLead.status_id === statusId) {
       setDraggedLead(null);
       return;
     }
 
     setLeads((prev) =>
       prev.map((l) => (l.id === draggedLead.id ? { ...l, status_id: statusId } : l))
     );
 
     try {
       const { error } = await supabase
         .from("leads")
         .update({ status_id: statusId })
         .eq("id", draggedLead.id);
 
       if (error) throw error;
 
       toast({
         title: "Lead movido!",
         description: `${draggedLead.nome} foi movido para a nova etapa.`,
       });
     } catch (error) {
       console.error("Erro ao mover lead:", error);
       setLeads((prev) =>
         prev.map((l) =>
           l.id === draggedLead.id ? { ...l, status_id: draggedLead.status_id } : l
         )
       );
       toast({
         title: "Erro",
         description: "Não foi possível mover o lead.",
         variant: "destructive",
       });
     } finally {
       setDraggedLead(null);
     }
   };
 
   const getLeadsByStatus = (statusId: string | null): Lead[] => {
     if (statusId === null) return filteredLeads.filter((l) => !l.status_id);
     return filteredLeads.filter((l) => l.status_id === statusId);
   };
 
   const handleViewDetails = (lead: Lead) => {
     toast({ title: "Ver detalhes", description: `Abrindo detalhes de ${lead.nome}` });
   };
 
    const handleQuickAction = async (lead: Lead, action: string) => {
      switch (action) {
        case "whatsapp":
          setSelectedLeadForWhatsApp(lead);
          setWhatsappOpen(true);
          break;
        case "call":
          window.open(`tel:${lead.telefone}`, "_self");
          break;
        case "markContacted":
          const { error } = await supabase
            .from("leads")
            .update({ ultimo_contato: new Date().toISOString() })
            .eq("id", lead.id);
          if (!error) {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === lead.id ? { ...l, ultimo_contato: new Date().toISOString() } : l
              )
            );
            toast({ title: "Contato registrado", description: "O lead foi marcado como contatado." });
          }
          break;
      }
    };
 
   if (loading) {
     return (
       <Card>
         <CardContent className="flex items-center justify-center py-12">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-4">
       <Card>
         <CardContent className="pt-4">
           <PipelineFilters
             searchTerm={searchTerm}
             onSearchChange={setSearchTerm}
             selectedVendedor={selectedVendedor}
             onVendedorChange={setSelectedVendedor}
             selectedEstado={selectedEstado}
             onEstadoChange={setSelectedEstado}
             consumoRange={consumoRange}
             onConsumoRangeChange={setConsumoRange}
             dateRange={dateRange}
             onDateRangeChange={setDateRange}
             vendedores={vendedores}
             estados={estados}
             activeFiltersCount={activeFiltersCount}
             onClearFilters={clearFilters}
           />
         </CardContent>
       </Card>
 
       <Tabs value={activeTab} onValueChange={setActiveTab}>
         <div className="flex items-center justify-between mb-4">
           <TabsList>
             <TabsTrigger value="kanban" className="gap-2">
               <LayoutGrid className="h-4 w-4" />
               Kanban
             </TabsTrigger>
             <TabsTrigger value="funnel" className="gap-2">
               <BarChart3 className="h-4 w-4" />
               Funil
             </TabsTrigger>
             <TabsTrigger value="automations" className="gap-2">
               <Settings2 className="h-4 w-4" />
               Automações
             </TabsTrigger>
           </TabsList>
 
           <div className="flex items-center gap-2 text-sm text-muted-foreground">
             <Badge variant="outline">{filteredLeads.length} leads</Badge>
             {activeFiltersCount > 0 && (
               <Badge variant="secondary">{activeFiltersCount} filtros ativos</Badge>
             )}
           </div>
         </div>
 
         <TabsContent value="kanban" className="mt-0">
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-base">Pipeline de Vendas</CardTitle>
               <CardDescription>Arraste os cards para mover leads entre etapas</CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="w-full">
                 <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
                   <div
                     className="w-80 flex-shrink-0"
                     onDragOver={handleDragOver}
                     onDrop={(e) => handleDrop(e, "")}
                   >
                     <div className="rounded-t-lg px-4 py-3 font-semibold text-sm flex items-center justify-between bg-muted text-muted-foreground">
                       <span>Sem Status</span>
                       <Badge variant="secondary">{getLeadsByStatus(null).length}</Badge>
                     </div>
                     <div className="bg-muted/30 rounded-b-lg p-2 min-h-[500px] space-y-2 border border-t-0">
                       {getLeadsByStatus(null).map((lead) => (
                         <KanbanCard
                           key={lead.id}
                           lead={lead}
                           onDragStart={handleDragStart}
                           isDragging={draggedLead?.id === lead.id}
                           onViewDetails={handleViewDetails}
                           onQuickAction={handleQuickAction}
                         />
                       ))}
                     </div>
                   </div>
 
                   {statuses.map((status) => (
                     <div
                       key={status.id}
                       className="w-80 flex-shrink-0"
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDrop(e, status.id)}
                     >
                       <div
                         className="rounded-t-lg px-4 py-3 font-semibold text-sm flex items-center justify-between"
                         style={{ backgroundColor: status.cor, color: "white" }}
                       >
                         <span>{status.nome}</span>
                         <Badge variant="secondary" className="bg-white/20 text-white border-0">
                           {getLeadsByStatus(status.id).length}
                         </Badge>
                       </div>
                       <div className="bg-muted/30 rounded-b-lg p-2 min-h-[500px] space-y-2 border border-t-0">
                         {getLeadsByStatus(status.id).map((lead) => (
                           <KanbanCard
                             key={lead.id}
                             lead={lead}
                             onDragStart={handleDragStart}
                             isDragging={draggedLead?.id === lead.id}
                             onViewDetails={handleViewDetails}
                             onQuickAction={handleQuickAction}
                           />
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
                 <ScrollBar orientation="horizontal" />
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         <TabsContent value="funnel" className="mt-0">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <EnhancedFunnel leads={filteredLeads} statuses={statuses} />
             <Card>
               <CardHeader>
                 <CardTitle className="text-base">Métricas por Status</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-3">
                   {statuses.map((status) => {
                     const statusLeads = getLeadsByStatus(status.id);
                     const avgConsumo = statusLeads.length > 0
                       ? Math.round(statusLeads.reduce((sum, l) => sum + l.media_consumo, 0) / statusLeads.length)
                       : 0;
                     
                     return (
                       <div key={status.id} className="flex items-center justify-between p-3 rounded-lg border">
                         <div className="flex items-center gap-3">
                           <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.cor }} />
                           <div>
                             <p className="font-medium text-sm">{status.nome}</p>
                             <p className="text-xs text-muted-foreground">{statusLeads.length} leads</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="text-sm font-medium">{avgConsumo} kWh</p>
                           <p className="text-xs text-muted-foreground">consumo médio</p>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
 
         <TabsContent value="automations" className="mt-0">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <PipelineAutomations
               statuses={statuses}
               onApplyAutomation={(rule) => {
                 toast({ title: "Automação aplicada", description: `Regra "${rule.name}" executada com sucesso.` });
               }}
             />
             <Card>
               <CardHeader>
                 <CardTitle className="text-base">Alertas Ativos</CardTitle>
                 <CardDescription>Leads que precisam de atenção</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-2">
                   {filteredLeads
                     .filter((l) => {
                       if (!l.ultimo_contato) return true;
                       const daysSince = Math.floor((Date.now() - new Date(l.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24));
                       return daysSince >= 3;
                     })
                     .slice(0, 5)
                     .map((lead) => (
                       <div key={lead.id} className="flex items-center justify-between p-2 rounded border bg-muted/50">
                         <div>
                           <p className="text-sm font-medium">{lead.nome}</p>
                           <p className="text-xs text-muted-foreground">{lead.lead_code}</p>
                         </div>
                         <Badge variant="destructive" className="text-xs">Sem contato</Badge>
                       </div>
                     ))}
                   {filteredLeads.filter((l) => !l.ultimo_contato || Math.floor((Date.now() - new Date(l.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)) >= 3).length === 0 && (
                     <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta ativo</p>
                   )}
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
        </Tabs>

        {/* WhatsApp Dialog */}
        {selectedLeadForWhatsApp && (
          <WhatsAppSendDialog
            open={whatsappOpen}
            onOpenChange={setWhatsappOpen}
            telefone={selectedLeadForWhatsApp.telefone}
            nome={selectedLeadForWhatsApp.nome}
            leadId={selectedLeadForWhatsApp.id}
            tipo="lead"
          />
        )}
      </div>
    );
  }
