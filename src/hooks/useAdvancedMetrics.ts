 import { useState, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 export interface AdvancedMetrics {
   tempo_medio_fechamento_dias: number;
   taxa_resposta_rapida_percent: number;
   ticket_medio: number;
   taxa_retencao_percent: number;
   total_leads_atendidos: number;
   leads_respondidos_24h: number;
   leads_convertidos: number;
   leads_perdidos: number;
   valor_total_vendas: number;
 }
 
 export interface MetaNotification {
   id: string;
   tipo_meta: string;
   percentual_atingido: number;
   lida: boolean;
   created_at: string;
 }
 
 export function useAdvancedMetrics(vendedorId: string | null, vendedorNome: string | null) {
   const [metrics, setMetrics] = useState<AdvancedMetrics | null>(null);
   const [notifications, setNotifications] = useState<MetaNotification[]>([]);
   const [loading, setLoading] = useState(false);
 
   const currentYear = new Date().getFullYear();
   const currentMonth = new Date().getMonth() + 1;
 
   const calculateMetrics = useCallback(async () => {
     if (!vendedorNome) return;
 
     setLoading(true);
     try {
       const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
       const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();
 
       // Buscar orçamentos do mês
       const { data: orcamentos } = await supabase
         .from("orcamentos")
         .select("id, created_at, ultimo_contato, status_id")
         .eq("vendedor", vendedorNome)
         .gte("created_at", startOfMonth)
         .lte("created_at", endOfMonth);
 
        // Buscar leads do vendedor primeiro para obter os IDs
        const { data: leads } = await supabase
          .from("leads")
          .select("id, created_at")
          .eq("vendedor", vendedorNome)
          .gte("created_at", startOfMonth)
          .lte("created_at", endOfMonth);

        const leadIds = leads?.map(l => l.id) || [];

        // Buscar clientes convertidos no mês que pertencem aos leads do vendedor
        const { data: clientes } = leadIds.length > 0
          ? await supabase
              .from("clientes")
              .select("id, created_at, valor_projeto, lead_id")
              .in("lead_id", leadIds)
              .gte("created_at", startOfMonth)
              .lte("created_at", endOfMonth)
          : { data: [] };
 
       // Buscar statuses para identificar "perdido"
       const { data: statuses } = await supabase
         .from("lead_status")
         .select("id, nome");
 
       const perdidoStatus = statuses?.find(s => 
         s.nome.toLowerCase().includes("perdido") || 
         s.nome.toLowerCase().includes("cancelado")
       );
 
        const totalOrcamentos = orcamentos?.length || 0;
        
        // Clientes já estão filtrados pelos leads do vendedor
        const clientesDoVendedor = clientes || [];
       
       // Calcular métricas
       let tempoMedioFechamento = 0;
       if (clientesDoVendedor.length > 0 && leads) {
         let totalDias = 0;
         let count = 0;
         for (const cliente of clientesDoVendedor) {
           const lead = leads.find(l => l.id === cliente.lead_id);
           if (lead) {
             const dias = Math.floor(
               (new Date(cliente.created_at).getTime() - new Date(lead.created_at).getTime()) 
               / (1000 * 60 * 60 * 24)
             );
             totalDias += dias;
             count++;
           }
         }
         tempoMedioFechamento = count > 0 ? totalDias / count : 0;
       }
 
       // Taxa de resposta rápida (orçamentos com ultimo_contato em < 24h)
       let respondidos24h = 0;
       if (orcamentos) {
         for (const orc of orcamentos) {
           if (orc.ultimo_contato) {
             const horasDiff = 
               (new Date(orc.ultimo_contato).getTime() - new Date(orc.created_at).getTime()) 
               / (1000 * 60 * 60);
             if (horasDiff <= 24) respondidos24h++;
           }
         }
       }
 
       // Orçamentos perdidos
       const orcamentosPerdidos = orcamentos?.filter(o => 
         perdidoStatus && o.status_id === perdidoStatus.id
       ).length || 0;
 
       // Calcular valor total
       const valorTotal = clientesDoVendedor.reduce(
         (sum, c) => sum + (Number(c.valor_projeto) || 0), 0
       );
 
       const newMetrics: AdvancedMetrics = {
         tempo_medio_fechamento_dias: Math.round(tempoMedioFechamento * 10) / 10,
         taxa_resposta_rapida_percent: totalOrcamentos > 0 
           ? Math.round((respondidos24h / totalOrcamentos) * 100) 
           : 0,
         ticket_medio: clientesDoVendedor.length > 0 
           ? valorTotal / clientesDoVendedor.length 
           : 0,
         taxa_retencao_percent: totalOrcamentos > 0 
           ? Math.round(((totalOrcamentos - orcamentosPerdidos) / totalOrcamentos) * 100) 
           : 100,
         total_leads_atendidos: totalOrcamentos,
         leads_respondidos_24h: respondidos24h,
         leads_convertidos: clientesDoVendedor.length,
         leads_perdidos: orcamentosPerdidos,
         valor_total_vendas: valorTotal,
       };
 
       setMetrics(newMetrics);
 
     } catch (error) {
       console.error("Error calculating metrics:", error);
     } finally {
       setLoading(false);
     }
   }, [vendedorNome, currentYear, currentMonth]);
 
   const fetchNotifications = useCallback(async () => {
     if (!vendedorId) return;
 
     const { data } = await supabase
       .from("meta_notifications")
       .select("*")
       .eq("vendedor_id", vendedorId)
       .eq("mes", currentMonth)
       .eq("ano", currentYear)
       .eq("lida", false)
       .order("created_at", { ascending: false });
 
     if (data) {
       setNotifications(data);
     }
   }, [vendedorId, currentMonth, currentYear]);
 
   const markNotificationAsRead = useCallback(async (notificationId: string) => {
     await supabase
       .from("meta_notifications")
       .update({ lida: true })
       .eq("id", notificationId);
 
     setNotifications(prev => prev.filter(n => n.id !== notificationId));
   }, []);
 
   const checkAndCreateProgressNotifications = useCallback(async (
     goals: { type: string; percentage: number }[],
     vendedorIdToUse: string
   ) => {
     const thresholds = [50, 80, 100];
 
     for (const goal of goals) {
       for (const threshold of thresholds) {
         if (goal.percentage >= threshold) {
           // Try to insert (will fail silently if already exists due to unique constraint)
           await supabase
             .from("meta_notifications")
             .insert({
               vendedor_id: vendedorIdToUse,
               mes: currentMonth,
               ano: currentYear,
               tipo_meta: goal.type,
               percentual_atingido: threshold,
             })
             .select()
             .maybeSingle();
         }
       }
     }
   }, [currentMonth, currentYear]);
 
   return {
     metrics,
     notifications,
     loading,
     calculateMetrics,
     fetchNotifications,
     markNotificationAsRead,
     checkAndCreateProgressNotifications,
   };
 }