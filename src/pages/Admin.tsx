import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Menu, ShieldAlert } from "lucide-react";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
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
import { TourProvider, HelpButton } from "@/components/tour";

// Lazy load admin sub-pages for better code splitting
const LeadsView = lazy(() => import("@/components/admin/views/LeadsView").then(m => ({ default: m.LeadsView })));
const LeadsPipeline = lazy(() => import("@/components/admin/LeadsPipeline"));
const FollowUpManager = lazy(() => import("@/components/admin/FollowUpManager"));
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
const PerformanceDashboard = lazy(() => import("@/components/admin/PerformanceDashboard"));
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

const TasksSlaDashboard = lazy(() => import("@/components/admin/tasks").then(m => ({ default: m.TasksSlaDashboard })));
const WaInbox = lazy(() => import("@/components/admin/inbox/WaInbox").then(m => ({ default: m.WaInbox })));
const WaQuickRepliesManager = lazy(() => import("@/components/admin/inbox/WaQuickRepliesManager").then(m => ({ default: m.WaQuickRepliesManager })));
const DistributionConfig = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.DistributionConfig })));
const SlaBreachDashboard = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.SlaBreachDashboard })));
const MotivoPerdaManager = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.MotivoPerdaManager })));
const WaFollowupRulesManager = lazy(() => import("@/components/admin/WaFollowupRulesManager").then(m => ({ default: m.WaFollowupRulesManager })));
const WaFollowupQueuePage = lazy(() => import("@/components/admin/WaFollowupQueuePage").then(m => ({ default: m.WaFollowupQueuePage })));
const WaAtendimentoMetrics = lazy(() => import("@/components/admin/WaAtendimentoMetrics").then(m => ({ default: m.WaAtendimentoMetrics })));
const WaInstancesManager = lazy(() => import("@/components/admin/WaInstancesManager").then(m => ({ default: m.WaInstancesManager })));
const WaTagsManager = lazy(() => import("@/components/admin/inbox/WaTagsManager").then(m => ({ default: m.WaTagsManager })));
const InstalarApp = lazy(() => import("@/pages/Instalar"));
const LinksInstalacaoPage = lazy(() => import("@/components/admin/LinksInstalacaoPage").then(m => ({ default: m.LinksInstalacaoPage })));
// CanaisCaptacaoPage removed — consolidated into LinksInstalacaoPage
const DataResetManager = lazy(() => import("@/components/admin/DataResetManager").then(m => ({ default: m.DataResetManager })));
const IntegrationStatusPage = lazy(() => import("@/components/admin/IntegrationStatusPage").then(m => ({ default: m.IntegrationStatusPage })));
const GoogleCalendarConfigPage = lazy(() => import("@/components/admin/GoogleCalendarConfigPage").then(m => ({ default: m.GoogleCalendarConfigPage })));
const AiConfigPage = lazy(() => import("@/pages/admin/AiConfigPage"));
const MenuConfigPage = lazy(() => import("@/components/admin/MenuConfigPage"));
const LoadingConfigAdmin = lazy(() => import("@/components/admin/LoadingConfigAdmin").then(m => ({ default: m.LoadingConfigAdmin })));
const AgendaConfigPage = lazy(() => import("@/components/admin/AgendaConfigPage").then(m => ({ default: m.AgendaConfigPage })));
const TenantSettings = lazy(() => import("@/components/admin/TenantSettings").then(m => ({ default: m.TenantSettings })));
const DocumentosPage = lazy(() => import("@/components/admin/documentos/DocumentosPage").then(m => ({ default: m.DocumentosPage })));
const ConfSolarPage = lazy(() => import("@/components/admin/conf-solar/ConfSolarPage").then(m => ({ default: m.ConfSolarPage })));
const PremissasPage = lazy(() => import("@/components/admin/premissas/PremissasPage").then(m => ({ default: m.PremissasPage })));
const IrradianciaPage = lazy(() => import("@/components/admin/irradiancia/IrradianciaPage"));
const BaseMeteorologicaPage = lazy(() => import("@/pages/admin/BaseMeteorologicaPage").then(m => ({ default: m.BaseMeteorologicaPage })));

const PricingPolicyPage = lazy(() => import("@/components/admin/pricing-policy/PricingPolicyPage").then(m => ({ default: m.PricingPolicyPage })));
const ProjetosManagerPage = lazy(() => import("@/components/admin/projetos").then(m => ({ default: m.ProjetosManager })));
// SolarZap removed — functionality consolidated into WaInbox (Atendimento)
const ProposalWizardPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalWizard").then((m) => ({
    default: m.ProposalWizard,
  }))
);

const SolarWizardPageLazy = lazy(() =>
  import("@/components/admin/propostas-nativas/solar-wizard/SolarWizardPage").then((m) => ({
    default: m.SolarWizardPage,
  }))
);

const ProposalListPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalList").then((m) => ({
    default: m.ProposalList,
  }))
);

const ProposalDetailPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalDetail").then((m) => ({
    default: m.ProposalDetail,
  }))
);

const TemplatesManagerPage = lazy(() =>
  import("@/components/admin/propostas-nativas/TemplatesManager").then((m) => ({
    default: m.TemplatesManager,
  }))
);

const VariaveisCustomPage = lazy(() =>
  import("@/components/admin/propostas-nativas/VariaveisCustomManager").then((m) => ({
    default: m.VariaveisCustomManager,
  }))
);

const ProposalDashboardPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalDashboard").then((m) => ({
    default: m.ProposalDashboard,
  }))
);

const ALLOWED_ADMIN_ROLES = ["admin", "gerente", "financeiro"];

const TAB_TITLES: Record<string, string> = {
  dashboard: "Painel Geral",
  inteligencia: "Inteligência Comercial",
  diretor: "Assistente IA",
  auditoria: "Registro de Atividades",
  leads: "Leads",
  pipeline: "Funil Comercial",
  distribuicao: "Distribuição de Leads",
  "sla-breaches": "Alertas de Prazo",
  "motivos-perda": "Motivos de Perda",
  inbox: "Atendimento",
  "respostas-rapidas": "Respostas Rápidas",
  followup: "Acompanhamentos",
  validacao: "Aprovação de Vendas",
  tarefas: "Tarefas & Prazos",
  clientes: "Clientes",
  checklists: "Documentação",
  avaliacoes: "Satisfação (NPS)",
  instaladores: "Equipe Técnica",
  servicos: "Agenda de Serviços",
  recebimentos: "Contas a Receber",
  inadimplencia: "Inadimplência",
  comissoes: "Comissões",
  engenharia: "Análise Tributária",
  financiamento: "Financiamentos",
  "site-config": "Conteúdo & Visual",
  brand: "Conteúdo & Visual",
  "site-servicos": "Serviços do Site",
  obras: "Portfólio",
  aprovacao: "Solicitações de Acesso",
  vendedores: "Consultores",
  usuarios: "Usuários & Permissões",
  gamificacao: "Metas & Ranking",
  "lead-status": "Etapas do Funil",
  equipamentos: "Disjuntores & Transf.",
  modulos: "Módulos Fotovoltaicos",
  "inversores-cadastro": "Inversores",
  baterias: "Baterias",
  concessionarias: "Concessionárias",
  config: "Calculadora Solar",
  whatsapp: "WhatsApp API",
  instagram: "Instagram",
  webhooks: "Webhooks",
  n8n: "Automações",
  
  "wa-instances": "Instâncias WhatsApp",
  release: "Checklist de Versão",
  propostas: "Propostas Comerciais",
  projetos: "Projetos",
  "propostas-nativas": "Gerador de Propostas",
  "propostas/novo": "Nova Proposta Solar",
  "propostas-nativas/nova": "Nova Proposta",
  "propostas-nativas/dashboard": "Painel de Propostas",
  "propostas-nativas/templates": "Templates de Proposta",
  "propostas-nativas/variaveis": "Variáveis Customizadas",
  "followup-wa": "Regras de Retorno",
  "followup-queue": "Fila de Retorno",
  "metricas-atendimento": "Métricas de Atendimento",
  "wa-etiquetas": "Etiquetas WhatsApp",
  // canais-captacao removed — use links-instalacao
  "links-instalacao": "Captação & App",
  documentos: "Documentos & Assinatura",
  "data-reset": "Manutenção de Dados",
  "integracoes-status": "Painel de Integrações",
  "google-calendar": "Google Calendar",
  "agenda-config": "Agenda & Calendário",
  "ai-config": "Configuração de IA",
  changelog: "Atualizações do Sistema",
  "notificacoes-config": "Notificações",
  "loading-config": "Personalização Visual",
  "tenant-settings": "Dados da Empresa",
  "conf-solar": "Premissas Solar",
  "pricing-policy": "Política de Precificação",
  menus: "Personalizar Menu",
  
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
      <TourProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar
          activeTab={activeTab}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          badgeCounts={badgeCounts}
          data-tour="sidebar"
        />
        
        <SidebarInset className="flex-1 min-w-0">
          <header className="page-header">
            <SidebarTrigger className="-ml-1 sm:-ml-2 h-9 w-9 sm:h-10 sm:w-10">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="h-5 w-px bg-border/50 hidden sm:block" />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="page-header-title">
                  {TAB_TITLES[activeTab] || activeTab}
                </h1>
                <HelpButton />
              </div>
              <AdminBreadcrumb activeTab={activeTab} />
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
                <Route path="performance" element={<PerformanceDashboard />} />
                <Route path="release" element={<ReleaseChecklist />} />
                
                {/* Comercial */}
                <Route path="leads" element={<LeadsView />} />
                <Route path="pipeline" element={<LeadsPipeline />} />
                <Route path="followup" element={<FollowUpManager diasAlerta={3} />} />
                <Route path="propostas" element={<PropostasManager />} />
                <Route path="projetos" element={<ProjetosManagerPage />} />
                <Route path="propostas-nativas" element={<ProposalListPage />} />
                <Route path="propostas-nativas/nova" element={<ProposalWizardPage />} />
                <Route path="propostas/novo" element={<SolarWizardPageLazy />} />
                <Route path="propostas-nativas/dashboard" element={<ProposalDashboardPage />} />
                <Route path="propostas-nativas/templates" element={<TemplatesManagerPage />} />
                <Route path="propostas-nativas/variaveis" element={<VariaveisCustomPage />} />
                <Route path="propostas-nativas/:propostaId/versoes/:versaoId" element={<ProposalDetailPage />} />
                <Route path="aprovacao" element={<AprovacaoUsuarios />} />
                <Route path="lead-status" element={<LeadStatusManager />} />
                <Route path="inteligencia" element={<IntelligenceDashboard />} />
                <Route path="distribuicao" element={<DistributionConfig />} />
                <Route path="sla-breaches" element={<SlaBreachDashboard />} />
                <Route path="motivos-perda" element={<MotivoPerdaManager />} />
                
                {/* Atendimento */}
                <Route path="inbox" element={<WaInbox />} />
                {/* SolarZap routes removed — consolidated into inbox */}
                <Route path="respostas-rapidas" element={<WaQuickRepliesManager />} />
                <Route path="followup-wa" element={<WaFollowupRulesManager />} />
                <Route path="followup-queue" element={<WaFollowupQueuePage />} />
                <Route path="metricas-atendimento" element={<WaAtendimentoMetrics />} />
                <Route path="wa-etiquetas" element={<WaTagsManager />} />
                <Route path="validacao" element={<ValidacaoVendasManager />} />
                <Route path="tarefas" element={<TasksSlaDashboard />} />
                
                {/* Clientes */}
                <Route path="clientes" element={<ClientesManager />} />
                <Route path="checklists" element={<ChecklistsManager />} />
                <Route path="avaliacoes" element={<AvaliacoesManager />} />
                <Route path="servicos" element={<ServicosManager />} />
                <Route path="documentos" element={<DocumentosPage />} />
                
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
                <Route path="conf-solar" element={<ConfSolarPage />} />
                <Route path="premissas" element={<PremissasPage />} />
                <Route path="irradiancia" element={<IrradianciaPage />} />
                <Route path="insumos-irradiacao" element={<Navigate to="/admin/base-meteorologica" replace />} />
                <Route path="base-meteorologica" element={<BaseMeteorologicaPage />} />
                <Route path="pricing-policy" element={<PricingPolicyPage />} />
                <Route path="gamificacao" element={<GamificacaoConfig />} />
                <Route path="loading-config" element={<LoadingConfigAdmin />} />
                <Route path="agenda-config" element={<AgendaConfigPage />} />
                
                {/* IA */}
                <Route path="diretor" element={<CommercialDirectorDashboard />} />
                
                {/* Integrações */}
                <Route path="wa-instances" element={<WaInstancesManager />} />
                <Route path="whatsapp" element={<WhatsAppAutomationConfig />} />
                <Route path="instagram" element={<InstagramConfig />} />
                
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
                <Route path="canais-captacao" element={<Navigate to="/admin/links-instalacao" replace />} />
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
      </TourProvider>
    </SidebarProvider>
  );
}