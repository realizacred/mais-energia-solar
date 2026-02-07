 import { useState, useEffect, useMemo, useCallback } from "react";
 import { useNavigate, useSearchParams } from "react-router-dom";
 import { useAuth } from "@/hooks/useAuth";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { useOrcamentosVendedor, OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
 import { useGamification } from "@/hooks/useGamification";
 import { useAdvancedMetrics } from "@/hooks/useAdvancedMetrics";
 import type { Lead } from "@/types/lead";
 
 export interface VendedorProfile {
   id: string;
   nome: string;
   codigo: string;
   telefone: string;
   email: string | null;
 }
 
 // Special admin profile when admin accesses without vendedor record
 const ADMIN_PROFILE: VendedorProfile = {
   id: "admin",
   nome: "Administrador",
   codigo: "admin",
   telefone: "",
   email: null,
 };
 
 // Convert orcamento to Lead format
 export const orcamentoToLead = (orc: OrcamentoVendedor): Lead => ({
   id: orc.lead_id,
   lead_code: orc.lead_code,
   nome: orc.nome,
   telefone: orc.telefone,
   telefone_normalized: orc.telefone.replace(/\D/g, ""),
   cep: orc.cep,
   estado: orc.estado,
   cidade: orc.cidade,
   bairro: orc.bairro,
   rua: orc.rua,
   numero: orc.numero,
   complemento: orc.complemento,
   area: orc.area,
   tipo_telhado: orc.tipo_telhado,
   rede_atendimento: orc.rede_atendimento,
   media_consumo: orc.media_consumo,
   consumo_previsto: orc.consumo_previsto,
   observacoes: orc.observacoes,
   arquivos_urls: orc.arquivos_urls,
   vendedor: orc.vendedor,
   visto: orc.visto,
   visto_admin: orc.visto_admin,
   status_id: orc.status_id,
   ultimo_contato: orc.ultimo_contato,
   proxima_acao: orc.proxima_acao,
   data_proxima_acao: orc.data_proxima_acao,
   created_at: orc.created_at,
   updated_at: orc.updated_at,
 });
 
 export function useVendedorPortal() {
   const { user, signOut } = useAuth();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const adminAsVendedor = searchParams.get("as"); // Admin viewing as specific vendor
  const [vendedor, setVendedor] = useState<VendedorProfile | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isViewingAsVendedor, setIsViewingAsVendedor] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
 
   // Filter states
   const [searchTerm, setSearchTerm] = useState("");
   const [filterVisto, setFilterVisto] = useState("todos");
   const [filterEstado, setFilterEstado] = useState("todos");
   const [filterStatus, setFilterStatus] = useState("todos");
 
   // Dialog states
   const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoVendedor | null>(null);
   const [isConvertOpen, setIsConvertOpen] = useState(false);
   const [orcamentoToConvert, setOrcamentoToConvert] = useState<OrcamentoVendedor | null>(null);
 
   // Gamification hook
   const gamification = useGamification(vendedor?.id || null);
 
   // Advanced metrics hook
   const advancedMetrics = useAdvancedMetrics(vendedor?.id || null, vendedor?.nome || null);
 
  // Orcamentos hook - when viewing as specific vendor, filter by that vendor
  const orcamentosData = useOrcamentosVendedor({
    vendedorNome: vendedor?.nome || null,
    isAdminMode,
    filterByVendedor: isViewingAsVendedor, // Force filter when viewing as specific vendor
  });
 
   // Load vendedor profile
   useEffect(() => {
     if (!user) {
       navigate("/auth?from=vendedor", { replace: true });
       return;
     }
 
     loadVendedorProfile();
   }, [user, navigate, adminAsVendedor]);
 
   const loadVendedorProfile = async () => {
     if (!user) return;
 
     try {
       const { data: userRoles } = await supabase
         .from("user_roles")
         .select("role")
         .eq("user_id", user.id);
 
       const isAdmin = userRoles?.some(r => r.role === "admin" || r.role === "gerente" || r.role === "financeiro");
 
       // If admin is viewing as specific vendor (via ?as=codigo parameter)
       if (isAdmin && adminAsVendedor) {
         const { data: targetVendedor, error: targetError } = await supabase
           .from("vendedores")
           .select("*")
           .eq("codigo", adminAsVendedor)
           .eq("ativo", true)
           .single();
 
         if (targetError || !targetVendedor) {
           toast({
             title: "Vendedor não encontrado",
             description: `Código "${adminAsVendedor}" não existe ou está inativo.`,
             variant: "destructive",
           });
           navigate("/admin", { replace: true });
           return;
         }
 
        setIsAdminMode(true);
        setIsViewingAsVendedor(true);
        setVendedor(targetVendedor);
        setInitialLoading(false);
        return;
      }
 
       // Normal flow: load user's own vendedor profile
       const { data: vendedorData, error: vendedorError } = await supabase
         .from("vendedores")
         .select("*")
         .eq("user_id", user.id)
         .single();
 
       if (vendedorError || !vendedorData) {
         if (isAdmin) {
           setIsAdminMode(true);
           setVendedor(ADMIN_PROFILE);
         } else {
           toast({
             title: "Acesso negado",
             description: "Seu usuário não está vinculado a um vendedor.",
             variant: "destructive",
           });
           await signOut();
           navigate("/auth", { replace: true });
           return;
         }
       } else {
         setVendedor(vendedorData);
       }
     } catch (error) {
       console.error("Error loading profile:", error);
       toast({
         title: "Erro",
         description: "Erro ao carregar dados.",
         variant: "destructive",
       });
     } finally {
       setInitialLoading(false);
     }
   };
 
   const handleSignOut = async () => {
     await signOut();
     navigate("/auth");
   };
 
   const copyLink = useCallback(() => {
     if (!vendedor) return;
     const link = `${window.location.origin}/v/${vendedor.codigo}`;
     navigator.clipboard.writeText(link);
     toast({
       title: "Link copiado!",
       description: "Seu link de vendedor foi copiado para a área de transferência.",
     });
   }, [vendedor]);
 
   const handleClearFilters = useCallback(() => {
     setFilterVisto("todos");
     setFilterEstado("todos");
     setFilterStatus("todos");
   }, []);
 
   // Convert orcamentos to leads
   const leadsForAlerts = useMemo(
     () => orcamentosData.orcamentos.map(orcamentoToLead),
     [orcamentosData.orcamentos]
   );
 
   // Calculate goals when data changes
   useEffect(() => {
     if (vendedor && orcamentosData.stats) {
       const startOfMonth = new Date();
       startOfMonth.setDate(1);
       startOfMonth.setHours(0, 0, 0, 0);
 
       const monthlyOrcamentos = orcamentosData.orcamentos.filter(
         (o) => new Date(o.created_at) >= startOfMonth
       ).length;
 
       gamification.calculateGoals(monthlyOrcamentos, 0, 0);
     }
   }, [vendedor, orcamentosData.stats, orcamentosData.orcamentos, gamification.calculateGoals]);
 
   // Calculate advanced metrics
   useEffect(() => {
     if (vendedor) {
       advancedMetrics.calculateMetrics();
       advancedMetrics.fetchNotifications();
     }
   }, [vendedor, advancedMetrics.calculateMetrics, advancedMetrics.fetchNotifications]);
 
   // Create progress notifications
   useEffect(() => {
     if (vendedor?.id && gamification.goals.length > 0) {
       const goalsForNotification = gamification.goals.map(g => ({
         type: g.type,
         percentage: g.percentage,
       }));
       advancedMetrics.checkAndCreateProgressNotifications(goalsForNotification, vendedor.id);
     }
   }, [gamification.goals, vendedor?.id, advancedMetrics.checkAndCreateProgressNotifications]);
 
   // Filtered orcamentos
   const filteredOrcamentos = useMemo(() => {
     let filtered = orcamentosData.orcamentos.filter(orc =>
       orc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
       orc.telefone.includes(searchTerm) ||
       orc.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (orc.orc_code && orc.orc_code.toLowerCase().includes(searchTerm.toLowerCase()))
     );
 
     if (filterVisto === "visto") {
       filtered = filtered.filter(orc => orc.visto);
     } else if (filterVisto === "nao_visto") {
       filtered = filtered.filter(orc => !orc.visto);
     }
 
     if (filterEstado !== "todos") {
       filtered = filtered.filter(orc => orc.estado === filterEstado);
     }
 
     if (filterStatus !== "todos") {
       if (filterStatus === "novo") {
         filtered = filtered.filter(orc => !orc.status_id);
       } else {
         filtered = filtered.filter(orc => orc.status_id === filterStatus);
       }
     }
 
     return filtered;
   }, [orcamentosData.orcamentos, searchTerm, filterVisto, filterEstado, filterStatus]);
 
  return {
    // Profile
    vendedor,
    isAdminMode,
    isViewingAsVendedor,
    loading: initialLoading || orcamentosData.loading,
 
     // Filters
     searchTerm,
     setSearchTerm,
     filterVisto,
     setFilterVisto,
     filterEstado,
     setFilterEstado,
     filterStatus,
     setFilterStatus,
     handleClearFilters,
 
     // Dialogs
     selectedOrcamento,
     setSelectedOrcamento,
     isConvertOpen,
     setIsConvertOpen,
     orcamentoToConvert,
     setOrcamentoToConvert,
 
     // Orcamentos
     orcamentos: orcamentosData.orcamentos,
     filteredOrcamentos,
     statuses: orcamentosData.statuses,
     stats: orcamentosData.stats,
     estados: orcamentosData.estados,
     fetchOrcamentos: orcamentosData.fetchOrcamentos,
     toggleVisto: orcamentosData.toggleVisto,
     updateStatus: orcamentosData.updateStatus,
     deleteOrcamento: orcamentosData.deleteOrcamento,
 
     // Gamification
     achievements: gamification.achievements,
     goals: gamification.goals,
     totalPoints: gamification.totalPoints,
 
     // Advanced Metrics
     advancedMetrics: advancedMetrics.metrics,
     metricsLoading: advancedMetrics.loading,
     goalNotifications: advancedMetrics.notifications,
     markNotificationAsRead: advancedMetrics.markNotificationAsRead,
 
     // Actions
     handleSignOut,
     copyLink,
     leadsForAlerts,
     orcamentoToLead,
   };
 }