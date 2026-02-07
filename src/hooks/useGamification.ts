 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 interface GamificationConfig {
   meta_orcamentos_mensal: number;
   meta_conversoes_mensal: number;
   meta_valor_mensal: number;
   comissao_base_percent: number;
   comissao_bonus_meta_percent: number;
   achievement_points: Record<string, number>;
 }
 
 interface VendedorMeta {
   meta_orcamentos: number | null;
   meta_conversoes: number | null;
   meta_valor: number | null;
   comissao_percent: number | null;
   usa_meta_individual: boolean;
 }
 
 export interface Achievement {
   id: string;
   type: string;
   name: string;
   description: string;
   icon: string;
   points: number;
   unlocked: boolean;
   unlocked_at?: string;
 }
 
 export interface VendedorPerformance {
   vendedor_id: string;
   vendedor_nome: string;
   total_orcamentos: number;
   total_conversoes: number;
   valor_total_vendas: number;
   pontuacao_total: number;
   posicao_ranking: number;
 }
 
 export interface GoalProgress {
   type: "orcamentos" | "conversoes" | "valor";
   label: string;
   current: number;
   target: number;
   percentage: number;
 }
 
 const ACHIEVEMENT_DEFINITIONS: Record<string, { name: string; description: string; icon: string }> = {
   first_conversion: {
     name: "Primeira Conversão",
     description: "Converteu seu primeiro lead em cliente",
     icon: "🎯",
   },
   fast_responder: {
     name: "Resposta Rápida",
     description: "Respondeu um lead em menos de 1 hora",
     icon: "⚡",
   },
   conversion_streak: {
     name: "Sequência Vencedora",
     description: "5 conversões consecutivas",
     icon: "🔥",
   },
   monthly_champion: {
     name: "Campeão do Mês",
     description: "1º lugar no ranking mensal",
     icon: "🏆",
   },
   top_performer: {
     name: "Top Performer",
     description: "Top 3 no ranking mensal",
     icon: "🥇",
   },
   consistency_king: {
     name: "Rei da Consistência",
     description: "Bateu metas 3 meses seguidos",
     icon: "👑",
   },
   high_volume: {
     name: "Alto Volume",
     description: "50+ orçamentos em um mês",
     icon: "📈",
   },
   perfect_month: {
     name: "Mês Perfeito",
     description: "100% de todas as metas batidas",
     icon: "💎",
   },
 };
 
 export function useGamification(vendedorId: string | null) {
   const [config, setConfig] = useState<GamificationConfig | null>(null);
   const [vendedorMeta, setVendedorMeta] = useState<VendedorMeta | null>(null);
   const [achievements, setAchievements] = useState<Achievement[]>([]);
   const [ranking, setRanking] = useState<VendedorPerformance[]>([]);
   const [goals, setGoals] = useState<GoalProgress[]>([]);
   const [loading, setLoading] = useState(true);
   const [myRankPosition, setMyRankPosition] = useState<number | null>(null);
   const [totalPoints, setTotalPoints] = useState(0);
 
   const currentYear = new Date().getFullYear();
   const currentMonth = new Date().getMonth() + 1;
 
   const fetchConfig = useCallback(async () => {
     const { data } = await supabase
       .from("gamification_config")
       .select("*")
       .limit(1)
       .single();
 
     if (data) {
       setConfig({
         meta_orcamentos_mensal: data.meta_orcamentos_mensal,
         meta_conversoes_mensal: data.meta_conversoes_mensal,
         meta_valor_mensal: Number(data.meta_valor_mensal),
         comissao_base_percent: Number(data.comissao_base_percent),
         comissao_bonus_meta_percent: Number(data.comissao_bonus_meta_percent),
         achievement_points: data.achievement_points as Record<string, number>,
       });
     }
   }, []);
 
   const fetchVendedorMeta = useCallback(async () => {
     if (!vendedorId) return;
 
     const { data } = await supabase
       .from("vendedor_metas")
       .select("*")
       .eq("vendedor_id", vendedorId)
       .eq("ano", currentYear)
       .eq("mes", currentMonth)
       .maybeSingle();
 
     if (data) {
       setVendedorMeta({
         meta_orcamentos: data.meta_orcamentos,
         meta_conversoes: data.meta_conversoes,
         meta_valor: data.meta_valor ? Number(data.meta_valor) : null,
         comissao_percent: data.comissao_percent ? Number(data.comissao_percent) : null,
         usa_meta_individual: data.usa_meta_individual || false,
       });
     }
   }, [vendedorId, currentYear, currentMonth]);
 
   const fetchAchievements = useCallback(async () => {
     if (!vendedorId || !config) return;
 
     const { data: unlockedAchievements } = await supabase
       .from("vendedor_achievements")
       .select("*")
       .eq("vendedor_id", vendedorId);
 
     const unlockedMap = new Map<string, string>(
       (unlockedAchievements || []).map((a) => [a.achievement_type as string, a.unlocked_at])
     );
 
       const allAchievements: Achievement[] = Object.entries(ACHIEVEMENT_DEFINITIONS).map(
       ([type, def]: [string, { name: string; description: string; icon: string }]) => ({
         id: type,
         type,
         name: def.name,
         description: def.description,
         icon: def.icon,
         points: config.achievement_points[type] || 0,
         unlocked: unlockedMap.has(type),
         unlocked_at: unlockedMap.get(type),
       })
     );
 
     setAchievements(allAchievements);
 
     // Calculate total points from unlocked achievements
     const points = allAchievements
       .filter((a) => a.unlocked)
       .reduce((sum, a) => sum + a.points, 0);
     setTotalPoints(points);
   }, [vendedorId, config]);
 
   const fetchRanking = useCallback(async () => {
     // Get performance data joined with vendedor names
     const { data: performanceData } = await supabase
       .from("vendedor_performance_mensal")
       .select(`
         vendedor_id,
         total_orcamentos,
         total_conversoes,
         valor_total_vendas,
         pontuacao_total,
         posicao_ranking
       `)
       .eq("ano", currentYear)
       .eq("mes", currentMonth)
       .order("pontuacao_total", { ascending: false });
 
     if (!performanceData || performanceData.length === 0) {
       // If no performance data, fetch from vendedores and calculate from orcamentos
       const { data: vendedores } = await supabase
         .from("vendedores")
         .select("id, nome")
         .eq("ativo", true);
 
       if (vendedores) {
         const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
         const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();
 
         const rankingData: VendedorPerformance[] = [];
 
          for (const v of vendedores) {
            // Count orcamentos for this vendor
            const { count: orcamentosCount } = await supabase
              .from("orcamentos")
              .select("*", { count: "exact", head: true })
              .eq("vendedor", v.nome)
              .gte("created_at", startOfMonth)
              .lte("created_at", endOfMonth);

            // Get leads from this vendor to count their conversions
            const { data: vendorLeads } = await supabase
              .from("leads")
              .select("id")
              .eq("vendedor", v.nome);
            
            const vendorLeadIds = vendorLeads?.map(l => l.id) || [];
            
            // Count clients converted from this vendor's leads
            let clientesCount = 0;
            if (vendorLeadIds.length > 0) {
              const { count } = await supabase
                .from("clientes")
                .select("*", { count: "exact", head: true })
                .in("lead_id", vendorLeadIds)
                .gte("created_at", startOfMonth)
                .lte("created_at", endOfMonth);
              clientesCount = count || 0;
            }

            rankingData.push({
              vendedor_id: v.id,
              vendedor_nome: v.nome,
              total_orcamentos: orcamentosCount || 0,
              total_conversoes: clientesCount,
              valor_total_vendas: 0,
              pontuacao_total: (orcamentosCount || 0) * 10 + clientesCount * 100,
              posicao_ranking: 0,
            });
          }
 
         // Sort by points and assign positions
         rankingData.sort((a, b) => b.pontuacao_total - a.pontuacao_total);
         rankingData.forEach((r, idx) => {
           r.posicao_ranking = idx + 1;
         });
 
         setRanking(rankingData);
 
         if (vendedorId) {
           const myPosition = rankingData.find((r) => r.vendedor_id === vendedorId);
           setMyRankPosition(myPosition?.posicao_ranking || null);
         }
       }
       return;
     }
 
     // Fetch vendedor names
     const vendedorIds = performanceData.map((p) => p.vendedor_id);
     const { data: vendedores } = await supabase
       .from("vendedores")
       .select("id, nome")
       .in("id", vendedorIds);
 
     const nameMap = new Map((vendedores || []).map((v) => [v.id, v.nome]));
 
     const rankingData = performanceData.map((p, idx) => ({
       vendedor_id: p.vendedor_id,
       vendedor_nome: nameMap.get(p.vendedor_id) || "Desconhecido",
       total_orcamentos: p.total_orcamentos,
       total_conversoes: p.total_conversoes,
       valor_total_vendas: Number(p.valor_total_vendas),
       pontuacao_total: p.pontuacao_total,
       posicao_ranking: p.posicao_ranking || idx + 1,
     }));
 
     setRanking(rankingData);
 
     if (vendedorId) {
       const myPosition = rankingData.find((r) => r.vendedor_id === vendedorId);
       setMyRankPosition(myPosition?.posicao_ranking || null);
     }
   }, [vendedorId, currentYear, currentMonth]);
 
   const calculateGoals = useCallback(
     (
       currentOrcamentos: number,
       currentConversoes: number,
       currentValor: number
     ) => {
       if (!config) return;
 
       // Use individual metas only if usa_meta_individual is true
       const useIndividual = vendedorMeta?.usa_meta_individual ?? false;
       
       const metaOrcamentos = useIndividual && vendedorMeta?.meta_orcamentos != null
         ? vendedorMeta.meta_orcamentos
         : config.meta_orcamentos_mensal;
       const metaConversoes = useIndividual && vendedorMeta?.meta_conversoes != null
         ? vendedorMeta.meta_conversoes
         : config.meta_conversoes_mensal;
       const metaValor = useIndividual && vendedorMeta?.meta_valor != null
         ? vendedorMeta.meta_valor
         : config.meta_valor_mensal;
 
       const goalsList: GoalProgress[] = [
         {
           type: "orcamentos",
           label: "Orçamentos do Mês",
           current: currentOrcamentos,
           target: metaOrcamentos,
           percentage: Math.min(100, (currentOrcamentos / metaOrcamentos) * 100),
         },
         {
           type: "conversoes",
           label: "Conversões do Mês",
           current: currentConversoes,
           target: metaConversoes,
           percentage: Math.min(100, (currentConversoes / metaConversoes) * 100),
         },
         {
           type: "valor",
           label: "Valor em Vendas",
           current: currentValor,
           target: metaValor,
           percentage: Math.min(100, (currentValor / metaValor) * 100),
         },
       ];
 
       setGoals(goalsList);
     },
     [config, vendedorMeta]
   );
 
   useEffect(() => {
     const loadData = async () => {
       setLoading(true);
       await fetchConfig();
       setLoading(false);
     };
     loadData();
   }, [fetchConfig]);
 
   useEffect(() => {
     if (config && vendedorId) {
       fetchVendedorMeta();
       fetchAchievements();
       fetchRanking();
     }
   }, [config, vendedorId, fetchVendedorMeta, fetchAchievements, fetchRanking]);
 
   return {
     config,
     vendedorMeta,
     achievements,
     ranking,
     goals,
     loading,
     myRankPosition,
     totalPoints,
     calculateGoals,
     refetch: async () => {
       await fetchConfig();
       await fetchVendedorMeta();
       await fetchAchievements();
       await fetchRanking();
     },
   };
 }