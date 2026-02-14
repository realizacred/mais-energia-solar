import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Menu, ShieldAlert } from "lucide-react";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { usePendingValidations } from "@/hooks/usePendingValidations";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/sidebar/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Footer from "@/components/layout/Footer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TrialBanner } from "@/components/plan";

// Lazy load admin sub-pages for better code splitting
const LeadsView = lazy(() => import("@/components/admin/views/LeadsView").then(m => ({ default: m.LeadsView })));
const LeadsPipeline = lazy(() => import("@/components/admin/LeadsPipeline"));
const FollowUpManager = lazy(() => import("@/components/admin/FollowUpManager"));
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
const VendedoresManager = lazy(() => import("@/components/admin/VendedoresManager"));
const CalculadoraConfig = lazy(() => import("@/components/admin/CalculadoraConfig"));
const FinanciamentoConfig = lazy(() => import("@/components/admin/FinanciamentoConfig"));
const WebhookManager = lazy(() => import("@/components/admin/WebhookManager"));
const ClientesManager = lazy(() => import("@/components/admin/ClientesManager").then(m => ({ default: m.ClientesManager })));
const RecebimentosManager = lazy(() => import("@/components/admin/RecebimentosManager").then(m => ({ default: m.RecebimentosManager })));
const InstagramConfig = lazy(() => import("@/components/admin/InstagramConfig").then(m => ({ default: m.InstagramConfig })));
const UsuariosManager = lazy(() => import("@/components/admin/UsuariosManager").then(m => ({ default: m.UsuariosManager })));
const EquipamentosManager = lazy(() => import("@/components/admin/EquipamentosManager").then(m => ({ default: m.EquipamentosManager })));
const ModulosManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.ModulosManager })));
const InversoresManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.InversoresManager })));
const BateriasManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.BateriasManager })));
const ConcessionariasManager = lazy(() => import("@/components/admin/ConcessionariasManager").then(m => ({ default: m.ConcessionariasManager })));
const GamificacaoConfig = lazy(() => import("@/components/admin/GamificacaoConfig").then(m => ({ default: m.GamificacaoConfig })));
const ComissoesManager = lazy(() => import("@/components/admin/ComissoesManager").then(m => ({ default: m.ComissoesManager })));
const ValidacaoVendasManager = lazy(() => import("@/components/admin/ValidacaoVendasManager").then(m => ({ default: m.ValidacaoVendasManager })));
const PropostasManager = lazy(() => import("@/components/admin/PropostasManager").then(m => ({ default: m.PropostasManager })));
const ChecklistsManager = lazy(() => import("@/components/admin/ChecklistsManager").then(m => ({ default: m.ChecklistsManager })));
const AvaliacoesManager = lazy(() => import("@/components/admin/AvaliacoesManager").then(m => ({ default: m.AvaliacoesManager })));
const ServicosManager = lazy(() => import("@/components/admin/ServicosManager").then(m => ({ default: m.ServicosManager })));
const InstaladorManager = lazy(() => import("@/components/admin/InstaladorManager").then(m => ({ default: m.InstaladorManager })));
const InadimplenciaDashboard = lazy(() => import("@/components/admin/InadimplenciaDashboard").then(m => ({ default: m.InadimplenciaDashboard })));
const WhatsAppAutomationConfig = lazy(() => import("@/components/admin/WhatsAppAutomationConfig").then(m => ({ default: m.WhatsAppAutomationConfig })));
const AprovacaoUsuarios = lazy(() => import("@/components/admin/AprovacaoUsuarios").then(m => ({ default: m.AprovacaoUsuarios })));
const AuditLogsViewer = lazy(() => import("@/components/admin/AuditLogsViewer").then(m => ({ default: m.AuditLogsViewer })));
const ReleaseChecklist = lazy(() => import("@/components/admin/ReleaseChecklist").then(m => ({ default: m.ReleaseChecklist })));
const ChangelogViewer = lazy(() => import("@/components/admin/ChangelogViewer").then(m => ({ default: m.ChangelogViewer })));
const NotificationConfigAdmin = lazy(() => import("@/components/admin/NotificationConfigAdmin").then(m => ({ default: m.NotificationConfigAdmin })));
const ObrasManager = lazy(() => import("@/components/admin/ObrasManager").then(m => ({ default: m.ObrasManager })));
const SiteSettingsUnified = lazy(() => import("@/components/admin/SiteSettingsUnified").then(m => ({ default: m.SiteSettingsUnified })));
const SiteServicosManager = lazy(() => import("@/components/admin/SiteServicosManager").then(m => ({ default: m.SiteServicosManager })));
const LeadStatusManager = lazy(() => import("@/components/admin/LeadStatusManager").then(m => ({ default: m.LeadStatusManager })));
const IntelligenceDashboard = lazy(() => import("@/components/admin/intelligence").then(m => ({ default: m.IntelligenceDashboard })));
const EngenhariaFinanceiraConfig = lazy(() => import("@/components/admin/EngenhariaFinanceiraConfig").then(m => ({ default: m.EngenhariaFinanceiraConfig })));
const CommercialDirectorDashboard = lazy(() => import("@/components/admin/director").then(m => ({ default: m.CommercialDirectorDashboard })));
const SolarMarketManager = lazy(() => import("@/components/admin/SolarMarketManager").then(m => ({ default: m.SolarMarketManager })));
const TasksSlaDashboard = lazy(() => import("@/components/admin/tasks").then(m => ({ default: m.TasksSlaDashboard })));
const WaInbox = lazy(() => import("@/components/admin/inbox/WaInbox").then(m => ({ default: m.WaInbox })));
const WaQuickRepliesManager = lazy(() => import("@/components/admin/inbox/WaQuickRepliesManager").then(m => ({ default: m.WaQuickRepliesManager })));
const DistributionConfig = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.DistributionConfig })));
const SlaBreachDashboard = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.SlaBreachDashboard })));
const MotivoPerdaManager = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.MotivoPerdaManager })));
const WaFollowupRulesManager = lazy(() => import("@/components/admin/WaFollowupRulesManager").then(m => ({ default: m.WaFollowupRulesManager })));
const WaFollowupQueuePage = lazy(() => import("@/components/admin/WaFollowupQueuePage").then(m => ({ default: m.WaFollowupQueuePage })));
const WaInstancesManager = lazy(() => import("@/components/admin/WaInstancesManager").then(m => ({ default: m.WaInstancesManager })));
const WaTagsManager = lazy(() => import("@/components/admin/inbox/WaTagsManager").then(m => ({ default: m.WaTagsManager })));
const InstalarApp = lazy(() => import("@/pages/Instalar"));
const LinksInstalacaoPage = lazy(() => import("@/components/admin/LinksInstalacaoPage").then(m => ({ default: m.LinksInstalacaoPage })));
const CanaisCaptacaoPage = lazy(() => import("@/components/admin/CanaisCaptacaoPage").then(m => ({ default: m.CanaisCaptacaoPage })));
const DataResetManager = lazy(() => import("@/components/admin/DataResetManager").then(m => ({ default: m.DataResetManager })));
const IntegrationStatusPage = lazy(() => import("@/components/admin/IntegrationStatusPage").then(m => ({ default: m.IntegrationStatusPage })));
const GoogleCalendarConfigPage = lazy(() => import("@/components/admin/GoogleCalendarConfigPage").then(m => ({ default: m.GoogleCalendarConfigPage })));
const AiConfigPage = lazy(() => import("@/pages/admin/AiConfigPage"));
const MenuConfigPage = lazy(() => import("@/components/admin/MenuConfigPage"));
const LoadingConfigAdmin = lazy(() => import("@/components/admin/LoadingConfigAdmin").then(m => ({ default: m.LoadingConfigAdmin })));
const AgendaConfigPage = lazy(() => import("@/components/admin/AgendaConfigPage").then(m => ({ default: m.AgendaConfigPage })));
const TenantSettings = lazy(() => import("@/components/admin/TenantSettings").then(m => ({ default: m.TenantSettings })));
const ProposalWizardPage = lazy(() => import("@/components/admin/propostas-nativas").then(m => ({ default: m.ProposalWizard })));
const ProposalListPage = lazy(() => import("@/components/admin/propostas-nativas").then(m => ({ default: m.ProposalList })));
const ProposalDetailPage = lazy(() => import("@/components/admin/propostas-nativas").then(m => ({ default: m.ProposalDetail })));

const ALLOWED_ADMIN_ROLES = ["admin", "gerente", "financeiro"];

const TAB_TITLES: Record<string, string> = {
  dashboard: "Dashboard Executivo",
  inteligencia: "Inteligência Comercial",
  diretor: "Copilot IA",
  auditoria: "Auditoria & Logs",
  leads: "Gestão de Leads",
  pipeline: "Pipeline de Vendas",
  distribuicao: "Distribuição de Leads",
  "sla-breaches": "Violações de SLA",
  "motivos-perda": "Motivos de Perda",
  inbox: "Central de Atendimento",
  "respostas-rapidas": "Respostas Rápidas",
  followup: "Follow-ups",
  validacao: "Validação de Vendas",
  tarefas: "Tarefas & SLA",
  clientes: "Gestão de Clientes",
  checklists: "Documentação",
  avaliacoes: "Avaliações",
  instaladores: "Gestão de Instaladores",
  servicos: "Agenda Técnica",
  recebimentos: "Controle de Recebimentos",
  inadimplencia: "Inadimplência",
  comissoes: "Gestão de Comissões",
  engenharia: "Engenharia Financeira",
  financiamento: "Bancos & Financiamento",
  "site-config": "Site Institucional",
  brand: "Site Institucional",
  "site-servicos": "Serviços do Site",
  obras: "Portfólio de Obras",
  aprovacao: "Aprovações de Acesso",
  vendedores: "Gestão de Consultores",
  usuarios: "Usuários & Permissões",
  gamificacao: "Gamificação",
  "lead-status": "Status de Leads",
  equipamentos: "Disjuntores & Transformadores",
  modulos: "Módulos Fotovoltaicos",
  "inversores-cadastro": "Inversores",
  baterias: "Baterias",
  concessionarias: "Concessionárias",
  config: "Calculadora Solar",
  whatsapp: "WhatsApp API",
  instagram: "Instagram API",
  webhooks: "Webhooks",
  n8n: "Automações",
  solarmarket: "SolarMarket",
  "wa-instances": "Instâncias WhatsApp",
  release: "Release Notes",
  propostas: "Propostas Comerciais",
  "propostas-nativas": "Gerador de Propostas",
  "propostas-nativas/nova": "Nova Proposta",
  "followup-wa": "Regras de Follow-up",
  "followup-queue": "Fila de Follow-ups",
  "wa-etiquetas": "Etiquetas WhatsApp",
  "canais-captacao": "Canais de Captação",
  "links-instalacao": "Links & Captação",
  "data-reset": "Limpeza de Dados",
  "integracoes-status": "Status das Integrações",
  "google-calendar": "Google Calendar",
  "agenda-config": "Agenda & Compromissos",
  "ai-config": "Configuração de IA",
  changelog: "Atualizações",
  "notificacoes-config": "Notificações",
  "loading-config": "Loading & Mensagens",
  "tenant-settings": "Configurações da Empresa",
};

/** N8n placeholder component */
function N8nPlaceholder() {
  return (
    <div className="content-section">
      <div className="content-section-header">
        <h3 className="text-base font-semibold">n8n - Automações</h3>
      </div>
      <div className="content-section-body">
        <div className="empty-state">
          <div className="empty-state-icon">
            <span className="text-2xl">🔧</span>
          </div>
          <p className="empty-state-title">Em desenvolvimento</p>
          <p className="empty-state-description">Configure workflows de automação via MCP.</p>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { pendingCount } = usePendingValidations();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Derive active tab from URL path
  const activeTab = useMemo(() => {
    const segments = location.pathname.replace("/admin", "").split("/").filter(Boolean);
    return segments[0] || "leads";
  }, [location.pathname]);

  const badgeCounts = useMemo(() => ({
    validacao: pendingCount,
  }), [pendingCount]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?from=admin", { replace: true });
      return;
    }

    if (user) {
      checkAdminAccess();
    }
  }, [user, authLoading, navigate]);

  const checkAdminAccess = async () => {
    if (!user) return;

    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const userHasAccess = roles?.some(r => 
        ALLOWED_ADMIN_ROLES.includes(r.role)
      );

      if (!userHasAccess) {
        const isVendedor = roles?.some(r => r.role === "consultor" || (r.role as string) === "vendedor");
        if (isVendedor) {
          navigate("/consultor", { replace: true });
        } else {
          setHasAccess(false);
        }
        return;
      }

      setHasAccess(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      setHasAccess(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Carregando painel..." size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Sua conta não possui permissão para acessar o painel administrativo. Contate o administrador.
            </p>
            <Button onClick={handleSignOut} variant="outline" className="mt-2">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar
          activeTab={activeTab}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          badgeCounts={badgeCounts}
        />
        
        <SidebarInset className="flex-1 min-w-0">
          <header className="page-header">
            <SidebarTrigger className="-ml-1 sm:-ml-2 h-9 w-9 sm:h-10 sm:w-10">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="h-5 w-px bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h1 className="page-header-title">
                {TAB_TITLES[activeTab] || activeTab}
              </h1>
            </div>
          </header>

          <TrialBanner />
          <main className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden animate-fade-in">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Default redirect */}
                <Route index element={<Navigate to="leads" replace />} />
                
                {/* Visão Geral */}
                <Route path="dashboard" element={<AnalyticsDashboard />} />
                <Route path="release" element={<ReleaseChecklist />} />
                
                {/* Comercial */}
                <Route path="leads" element={<LeadsView />} />
                <Route path="pipeline" element={<LeadsPipeline />} />
                <Route path="followup" element={<FollowUpManager diasAlerta={3} />} />
                <Route path="propostas" element={<PropostasManager />} />
                <Route path="propostas-nativas" element={<ProposalListPage />} />
                <Route path="propostas-nativas/nova" element={<ProposalWizardPage />} />
                <Route path="propostas-nativas/:propostaId/versoes/:versaoId" element={<ProposalDetailPage />} />
                <Route path="aprovacao" element={<AprovacaoUsuarios />} />
                <Route path="lead-status" element={<LeadStatusManager />} />
                <Route path="inteligencia" element={<IntelligenceDashboard />} />
                <Route path="distribuicao" element={<DistributionConfig />} />
                <Route path="sla-breaches" element={<SlaBreachDashboard />} />
                <Route path="motivos-perda" element={<MotivoPerdaManager />} />
                
                {/* Atendimento */}
                <Route path="inbox" element={<WaInbox />} />
                <Route path="respostas-rapidas" element={<WaQuickRepliesManager />} />
                <Route path="followup-wa" element={<WaFollowupRulesManager />} />
                <Route path="followup-queue" element={<WaFollowupQueuePage />} />
                <Route path="wa-etiquetas" element={<WaTagsManager />} />
                <Route path="validacao" element={<ValidacaoVendasManager />} />
                <Route path="tarefas" element={<TasksSlaDashboard />} />
                
                {/* Clientes */}
                <Route path="clientes" element={<ClientesManager />} />
                <Route path="checklists" element={<ChecklistsManager />} />
                <Route path="avaliacoes" element={<AvaliacoesManager />} />
                <Route path="servicos" element={<ServicosManager />} />
                
                {/* Operações */}
                <Route path="instaladores" element={<InstaladorManager />} />
                
                {/* Financeiro */}
                <Route path="recebimentos" element={<RecebimentosManager />} />
                <Route path="inadimplencia" element={<InadimplenciaDashboard />} />
                <Route path="comissoes" element={<ComissoesManager />} />
                <Route path="engenharia" element={<EngenhariaFinanceiraConfig />} />
                <Route path="financiamento" element={<FinanciamentoConfig />} />
                
                {/* Cadastros */}
                <Route path="vendedores" element={<VendedoresManager />} />
                <Route path="usuarios" element={<UsuariosManager />} />
                <Route path="equipamentos" element={<EquipamentosManager />} />
                <Route path="modulos" element={<ModulosManager />} />
                <Route path="inversores-cadastro" element={<InversoresManager />} />
                <Route path="baterias" element={<BateriasManager />} />
                <Route path="concessionarias" element={<ConcessionariasManager />} />
                <Route path="config" element={<CalculadoraConfig />} />
                <Route path="gamificacao" element={<GamificacaoConfig />} />
                <Route path="loading-config" element={<LoadingConfigAdmin />} />
                <Route path="agenda-config" element={<AgendaConfigPage />} />
                
                {/* IA */}
                <Route path="diretor" element={<CommercialDirectorDashboard />} />
                
                {/* Integrações */}
                <Route path="wa-instances" element={<WaInstancesManager />} />
                <Route path="whatsapp" element={<WhatsAppAutomationConfig />} />
                <Route path="instagram" element={<InstagramConfig />} />
                <Route path="solarmarket" element={<SolarMarketManager />} />
                <Route path="webhooks" element={<WebhookManager />} />
                <Route path="n8n" element={<N8nPlaceholder />} />
                <Route path="google-calendar" element={<AgendaConfigPage />} />
                <Route path="ai-config" element={<AiConfigPage />} />
                
                {/* Site */}
                <Route path="site-config" element={<SiteSettingsUnified />} />
                <Route path="brand" element={<SiteSettingsUnified />} />
                <Route path="site-servicos" element={<SiteServicosManager />} />
                <Route path="obras" element={<ObrasManager />} />
                
                {/* Administração */}
                <Route path="tenant-settings" element={<TenantSettings />} />
                <Route path="auditoria" element={<AuditLogsViewer />} />
                <Route path="data-reset" element={<DataResetManager />} />
                <Route path="integracoes-status" element={<IntegrationStatusPage />} />
                <Route path="canais-captacao" element={<CanaisCaptacaoPage />} />
                <Route path="links-instalacao" element={<LinksInstalacaoPage isAdminView />} />
                <Route path="changelog" element={<ChangelogViewer />} />
                <Route path="notificacoes-config" element={<NotificationConfigAdmin />} />
                <Route path="menus" element={<MenuConfigPage />} />
                
                {/* Catch-all */}
                <Route path="*" element={<Navigate to="leads" replace />} />
              </Routes>
            </Suspense>
          </main>

          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}