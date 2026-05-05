import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Menu, ShieldAlert } from "lucide-react";
import { SistemaInstallBanner } from "@/components/pwa/SistemaInstallBanner";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminRouteBoundary } from "@/components/admin/AdminRouteBoundary";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { usePendingValidations } from "@/hooks/usePendingValidations";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/sidebar/AdminSidebar";
import { SidebarResizer } from "@/components/admin/sidebar/SidebarResizer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { TrialBanner, UpsellBanner, PlanStatusBadge } from "@/components/plan";
import { FeatureDiscoveryLayer } from "@/components/FeatureDiscoveryLayer";
import { HelpCenterDrawer } from "@/components/help/HelpCenterDrawer";
import { HeaderSearch } from "@/components/admin/HeaderSearch";
import { NotificationsDropdown } from "@/components/admin/NotificationsDropdown";
import { AgendaSheet } from "@/components/admin/AgendaSheet";
import { ProfileDropdown } from "@/components/admin/ProfileDropdown";
import { HelpDropdown } from "@/components/admin/HelpDropdown";
import { useNewLeadAlert } from "@/hooks/useNewLeadAlert";
import { useProposalViewAlert } from "@/hooks/useProposalViewAlert";


// Lazy load admin sub-pages for better code splitting
const LeadsView = lazy(() => import("@/components/admin/views/LeadsView").then(m => ({ default: m.LeadsView })));
const LeadsPipeline = lazy(() => import("@/components/admin/LeadsPipeline"));
const FollowUpManager = lazy(() => import("@/components/admin/FollowUpManager"));
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
const PerformanceDashboard = lazy(() => import("@/components/admin/PerformanceDashboard"));
const VendedoresManager = lazy(() => import("@/components/admin/VendedoresManager"));
const CalculadoraConfig = lazy(() => import("@/components/admin/CalculadoraConfig"));
const FinanciamentoConfig = lazy(() => import("@/components/admin/FinanciamentoConfig"));
const FormasPagamentoPage = lazy(() => import("@/components/admin/FormasPagamentoPage").then(m => ({ default: m.FormasPagamentoPage })));
const WebhookManager = lazy(() => import("@/components/admin/WebhookManager"));
const SolarmarketConfigPage = lazy(() => import("@/pages/admin/SolarmarketConfigPage"));
const MigracaoSolarmarket = lazy(() => import("@/pages/admin/MigracaoSolarmarket"));
const MigracaoStep2Mapear = lazy(() => import("@/pages/admin/MigracaoStep2Mapear"));
const MigracaoStep3CustomFields = lazy(() => import("@/pages/admin/MigracaoStep3CustomFields"));
const MigracaoStep3Migrar = lazy(() => import("@/pages/admin/MigracaoStep3Migrar"));
const SolarmarketDiagnosticPage = lazy(() => import("@/pages/admin/SolarmarketDiagnosticPage"));
// Páginas órfãs removidas: SolarmarketMapeamentos, SolarmarketMappingPage, ImportacaoSolarmarket, PromocaoSolarmarket.
// Todas as rotas legadas redirecionam para /admin/migracao-solarmarket (wizard unificado).
const ClientesManager = lazy(() => import("@/components/admin/ClientesManager").then(m => ({ default: m.ClientesManager })));
const RecebimentosManager = lazy(() => import("@/components/admin/RecebimentosManager").then(m => ({ default: m.RecebimentosManager })));
const FinanceiroDashboard = lazy(() => import("@/components/admin/FinanceiroDashboard").then(m => ({ default: m.FinanceiroDashboard })));
const InstagramConfig = lazy(() => import("@/components/admin/InstagramConfig").then(m => ({ default: m.InstagramConfig })));
const UsuariosManager = lazy(() => import("@/components/admin/UsuariosManager").then(m => ({ default: m.UsuariosManager })));
const EquipamentosManager = lazy(() => import("@/components/admin/EquipamentosManager").then(m => ({ default: m.EquipamentosManager })));
const FornecedoresManager = lazy(() => import("@/components/admin/FornecedoresManager").then(m => ({ default: m.FornecedoresManager })));
const ModulosManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.ModulosManager })));
const InversoresManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.InversoresManager })));
const InversoresAuditPage = lazy(() => import("@/components/admin/equipamentos/inversores/InversoresAuditPage").then(m => ({ default: m.InversoresAuditPage })));
const BateriasManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.BateriasManager })));
const BateriasAuditPage = lazy(() => import("@/components/admin/equipamentos/baterias/BateriasAuditPage").then(m => ({ default: m.BateriasAuditPage })));
const OtimizadoresManager = lazy(() => import("@/components/admin/equipamentos").then(m => ({ default: m.OtimizadoresManager })));
const OtimizadoresAuditPage = lazy(() => import("@/components/admin/equipamentos/otimizadores/OtimizadoresAuditPage").then(m => ({ default: m.OtimizadoresAuditPage })));
const ModulosAuditPage = lazy(() => import("@/components/admin/equipamentos/modulos/ModulosAuditPage").then(m => ({ default: m.ModulosAuditPage })));
const EquipmentTabs = lazy(() => import("@/components/admin/equipamentos/shared/EquipmentTabs").then(m => ({ default: m.EquipmentTabs })));
const ConcessionariasManager = lazy(() => import("@/components/admin/ConcessionariasManager").then(m => ({ default: m.ConcessionariasManager })));
const DicionarioAneelPage = lazy(() => import("@/components/admin/concessionarias/DicionarioAneelPage").then(m => ({ default: m.DicionarioAneelPage })));
const TarifaVersoesPage = lazy(() => import("@/components/admin/concessionarias/TarifaVersoesPage").then(m => ({ default: m.TarifaVersoesPage })));
const SaudeTarifariaPage = lazy(() => import("@/components/admin/concessionarias/SaudeTarifariaPage").then(m => ({ default: m.SaudeTarifariaPage })));
const AneelSyncStatusPage = lazy(() => import("@/components/admin/concessionarias/AneelSyncStatusPage").then(m => ({ default: m.AneelSyncStatusPage })));
const GamificacaoConfig = lazy(() => import("@/components/admin/GamificacaoConfig").then(m => ({ default: m.GamificacaoConfig })));
const ComissoesManager = lazy(() => import("@/components/admin/ComissoesManager").then(m => ({ default: m.ComissoesManager })));
const ValidacaoVendasManager = lazy(() => import("@/components/admin/ValidacaoVendasManager").then(m => ({ default: m.ValidacaoVendasManager })));
const PropostasManager = lazy(() => import("@/components/admin/PropostasManager").then(m => ({ default: m.PropostasManager })));
const ChecklistsManager = lazy(() => import("@/components/admin/ChecklistsManager").then(m => ({ default: m.ChecklistsManager })));
const AvaliacoesManager = lazy(() => import("@/components/admin/AvaliacoesManager").then(m => ({ default: m.AvaliacoesManager })));
const ServicosManager = lazy(() => import("@/components/admin/ServicosManager").then(m => ({ default: m.ServicosManager })));
const VisitasCalendario = lazy(() => import("@/components/admin/visitas/VisitasCalendario").then(m => ({ default: m.VisitasCalendario })));
const InstaladorManager = lazy(() => import("@/components/admin/InstaladorManager").then(m => ({ default: m.InstaladorManager })));
const EstoquePage = lazy(() => import("@/components/admin/estoque/EstoquePage"));
const DepositosPage = lazy(() => import("@/components/admin/estoque/DepositosPage").then(m => ({ default: m.DepositosPage })));
const CategoriasEstoquePage = lazy(() => import("@/components/admin/estoque/CategoriasPage"));
const SuprimentosListPage = lazy(() => import("@/components/admin/suprimentos/SuprimentosListPage"));
const OrdemCompraDetalhePage = lazy(() => import("@/components/admin/suprimentos/OrdemCompraDetalhePage"));
const UCsListPage = lazy(() => import("@/components/admin/ucs/UCsListPage"));
const UCDetailPage = lazy(() => import("@/components/admin/ucs/UCDetailPage"));
const MetersListPage = lazy(() => import("@/components/admin/meters/MetersListPage"));
const MeterDetailPage = lazy(() => import("@/components/admin/meters/MeterDetailPage"));
const FaturasEnergiaPage = lazy(() => import("@/components/admin/faturas/FaturasEnergiaPage"));
const InvoiceReviewPage = lazy(() => import("@/components/admin/faturas/InvoiceReviewPage"));
const ExtractionCenterPage = lazy(() => import("@/components/admin/extraction/ExtractionCenterPage"));
// GdGroupsPage removida — funcionalidade migrada para aba Beneficiárias na UC
const EnergyAlertsPage = lazy(() => import("@/components/admin/energia/EnergyAlertsPage").then(m => ({ default: m.EnergyAlertsPage })));
const EnergiaDashboard = lazy(() => import("@/components/admin/energia/EnergiaDashboard"));
const GdAutomationPage = lazy(() => import("@/components/admin/energia/GdAutomationPage").then(m => ({ default: m.GdAutomationPage })));
const EnergyFinancialPage = lazy(() => import("@/components/admin/energia/EnergyFinancialPage").then(m => ({ default: m.EnergyFinancialPage })));
const ClienteEnergiaDashboardPage = lazy(() => import("@/components/admin/energia/ClienteEnergiaDashboardPage").then(m => ({ default: m.ClienteEnergiaDashboardPage })));
const EmailIntegrationsPage = lazy(() => import("@/components/admin/email/EmailIntegrationsPage").then(m => ({ default: m.EmailIntegrationsPage })));
const InadimplenciaDashboard = lazy(() => import("@/components/admin/InadimplenciaDashboard").then(m => ({ default: m.InadimplenciaDashboard })));
const FechamentoCaixaPage = lazy(() => import("@/components/admin/FechamentoCaixaPage").then(m => ({ default: m.FechamentoCaixaPage })));
const LancamentosPage = lazy(() => import("@/components/admin/financeiro/LancamentosPage"));
const DREPage = lazy(() => import("@/components/admin/financeiro/DREPage"));
const AutomacoesPage = lazy(() => import("@/pages/AutomacoesPage"));
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
const IntelligenceConfigPage = lazy(() => import("@/components/admin/intelligence").then(m => ({ default: m.IntelligenceConfigPage })));
const IntelligenceMetricsPage = lazy(() => import("@/components/admin/intelligence").then(m => ({ default: m.IntelligenceMetricsPage })));
const IntelligenceAlertsPage = lazy(() => import("@/components/admin/intelligence").then(m => ({ default: m.IntelligenceAlertsPage })));
const EngenhariaFinanceiraConfig = lazy(() => import("@/components/admin/EngenhariaFinanceiraConfig").then(m => ({ default: m.EngenhariaFinanceiraConfig })));
const ProposalMessageConfigPage = lazy(() => import("@/pages/admin/ProposalMessageConfigPage"));
const CommercialDirectorDashboard = lazy(() => import("@/components/admin/director").then(m => ({ default: m.CommercialDirectorDashboard })));
const ConsultorDashboard = lazy(() => import("@/pages/ConsultorDashboard"));

const TasksSlaDashboard = lazy(() => import("@/components/admin/tasks").then(m => ({ default: m.TasksSlaDashboard })));
const WaInbox = lazy(() => import("@/components/admin/inbox/WaInbox").then(m => ({ default: m.WaInbox })));
const WaQuickRepliesManager = lazy(() => import("@/components/admin/inbox/WaQuickRepliesManager").then(m => ({ default: m.WaQuickRepliesManager })));
const DistributionConfig = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.DistributionConfig })));
const SlaBreachDashboard = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.SlaBreachDashboard })));
const MotivoPerdaManager = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.MotivoPerdaManager })));
const LeadOrigensManager = lazy(() => import("@/components/admin/distribution").then(m => ({ default: m.LeadOrigensManager })));
const WaFollowupRulesManager = lazy(() => import("@/components/admin/WaFollowupRulesManager").then(m => ({ default: m.WaFollowupRulesManager })));
const WaFollowupQueuePage = lazy(() => import("@/components/admin/WaFollowupQueuePage").then(m => ({ default: m.WaFollowupQueuePage })));
const WaAtendimentoMetrics = lazy(() => import("@/components/admin/WaAtendimentoMetrics").then(m => ({ default: m.WaAtendimentoMetrics })));
const WaInstancesManager = lazy(() => import("@/components/admin/WaInstancesManager").then(m => ({ default: m.WaInstancesManager })));
const WaTagsManager = lazy(() => import("@/components/admin/inbox/WaTagsManager").then(m => ({ default: m.WaTagsManager })));
const InstalarApp = lazy(() => import("@/pages/Instalar"));
const LinksInstalacaoPage = lazy(() => import("@/components/admin/LinksInstalacaoPage").then(m => ({ default: m.LinksInstalacaoPage })));
// CanaisCaptacaoPage removed — consolidated into LinksInstalacaoPage
const DataResetManager = lazy(() => import("@/components/admin/DataResetManager").then(m => ({ default: m.DataResetManager })));
const BackupRestorePage = lazy(() => import("@/components/admin/BackupRestorePage").then(m => ({ default: m.BackupRestorePage })));
const LeadsTrashPage = lazy(() => import("@/components/admin/leads/LeadsTrashPage"));
const IntegrationsPage = lazy(() => import("@/components/admin/integrations/IntegrationsPage"));
const IntegrationHealthPage = lazy(() => import("@/components/admin/integrations/IntegrationHealthPage"));
const MonitoringPage = lazy(() => import("@/components/admin/monitoring/MonitoringPage"));
const MonitoringModule = lazy(() => import("@/components/admin/monitoring-v2/MonitoringModule"));
const IntegrationsCatalogPage = lazy(() => import("@/components/admin/integrations-v2/IntegrationsCatalogPage"));
const AneelIntegrationPage = lazy(() => import("@/components/admin/integrations/AneelIntegrationPage").then(m => ({ default: m.AneelIntegrationPage })));
const AiConfigPage = lazy(() => import("@/pages/admin/AiConfigPage"));
const OpenAIConfigPage = lazy(() => import("@/pages/admin/OpenAIConfigPage"));
const GeminiConfigPage = lazy(() => import("@/pages/admin/GeminiConfigPage"));
const MetaFacebookConfigPage = lazy(() => import("@/pages/admin/MetaFacebookConfigPage"));
const MetaDashboardPage = lazy(() => import("@/pages/admin/meta/MetaDashboardPage"));
const MetaLeadsPage = lazy(() => import("@/pages/admin/meta/MetaLeadsPage"));
const MetaCampaignsPage = lazy(() => import("@/pages/admin/meta/MetaCampaignsPage"));
const GoogleMapsConfigPage = lazy(() => import("@/pages/admin/GoogleMapsConfigPage"));
const PaymentGatewayConfigPage = lazy(() => import("@/components/admin/settings/PaymentGatewayConfig").then(m => ({ default: m.PaymentGatewayConfig })));
const MenuConfigPage = lazy(() => import("@/components/admin/MenuConfigPage"));
const LoadingConfigAdmin = lazy(() => import("@/components/admin/LoadingConfigAdmin").then(m => ({ default: m.LoadingConfigAdmin })));
// AgendaConfigPage removed
const TenantSettings = lazy(() => import("@/components/admin/TenantSettings").then(m => ({ default: m.TenantSettings })));
const CustomFieldsSettings = lazy(() => import("@/components/admin/projetos/CustomFieldsSettings").then(m => ({ default: m.CustomFieldsSettings })));
const DocumentosPage = lazy(() => import("@/components/admin/documentos/DocumentosPage").then(m => ({ default: m.DocumentosPage })));
const ConfSolarPage = lazy(() => import("@/components/admin/conf-solar/ConfSolarPage").then(m => ({ default: m.ConfSolarPage })));
const VariaveisSystemPage = lazy(() => import("@/components/admin/variaveis/VariaveisSystemPage").then(m => ({ default: m.VariaveisSystemPage })));
const PremissasPage = lazy(() => import("@/components/admin/premissas/PremissasPage").then(m => ({ default: m.PremissasPage })));
const BaseMeteorologicaPage = lazy(() => import("@/pages/admin/BaseMeteorologicaPage").then(m => ({ default: m.BaseMeteorologicaPage })));
const PropostaComercialPage = lazy(() => import("@/components/admin/proposta-comercial").then(m => ({ default: m.PropostaComercialPage })));
const PricingPolicyPage = lazy(() => import("@/components/admin/pricing-policy/PricingPolicyPage").then(m => ({ default: m.PricingPolicyPage })));
const ContactsPage = lazy(() => import("@/pages/admin/ContactsPage"));
const FiscalPage = lazy(() => import("@/components/admin/fiscal/FiscalPage"));
const RolePermissionsManager = lazy(() => import("@/components/admin/RolePermissionsManager").then(m => ({ default: m.RolePermissionsManager })));
const WaHealthDashboard = lazy(() => import("@/pages/admin/WaHealthDashboard"));
const AuditoriaTelefonesPage = lazy(() => import("@/pages/admin/AuditoriaTelefonesPage"));
const WaSaudePage = lazy(() => import("@/pages/admin/WaSaudePage"));
const WhatsappInstanciasPage = lazy(() => import("@/pages/admin/integracoes/whatsapp/WhatsappInstanciasPage"));
const WhatsappIaResolucaoPage = lazy(() => import("@/pages/admin/integracoes/whatsapp/WhatsappIaResolucaoPage"));
const WhatsappAutoRespostasPage = lazy(() => import("@/pages/admin/integracoes/whatsapp/WhatsappAutoRespostasPage"));
const WhatsappFollowupPage = lazy(() => import("@/pages/admin/integracoes/whatsapp/WhatsappFollowupPage"));
const SolarmarketMigracaoPage = lazy(() => import("@/pages/admin/integracoes/solarmarket/SolarmarketMigracaoPage"));
const SolarmarketFunisPage = lazy(() => import("@/pages/admin/integracoes/solarmarket/SolarmarketFunisPage"));
const SolarmarketEtapasPage = lazy(() => import("@/pages/admin/integracoes/solarmarket/SolarmarketEtapasPage"));
const SolarmarketConsultoresPage = lazy(() => import("@/pages/admin/integracoes/solarmarket/SolarmarketConsultoresPage"));
const SolarmarketLogsPage = lazy(() => import("@/pages/admin/integracoes/solarmarket/SolarmarketLogsPage"));
const IaProvedoresPage = lazy(() => import("@/pages/admin/integracoes/ia/IaProvedoresPage"));
const IaFeaturesPage = lazy(() => import("@/pages/admin/integracoes/ia/IaFeaturesPage"));
const IaLeadScoringPage = lazy(() => import("@/pages/admin/integracoes/ia/IaLeadScoringPage"));
const ConexoesProvedoresPage = lazy(() => import("@/pages/admin/integracoes/conexoes/ConexoesProvedoresPage"));
const ConexoesCredenciaisPage = lazy(() => import("@/pages/admin/integracoes/conexoes/ConexoesCredenciaisPage"));
const ConexoesJobsPage = lazy(() => import("@/pages/admin/integracoes/conexoes/ConexoesJobsPage"));
const ConexoesLogsPage = lazy(() => import("@/pages/admin/integracoes/conexoes/ConexoesLogsPage"));
const DevToolsPage = lazy(() => import("@/pages/admin/DevToolsPage"));
const RlsTestPage = lazy(() => import("@/pages/admin/dev/RlsTestPage"));
const BillingFeaturesPage = lazy(() => import("@/components/admin/billing/BillingFeaturesPage"));
const CommercialDashboardPage = lazy(() => import("@/components/admin/billing/CommercialDashboardPage"));
const ProposalFunnelDashboard = lazy(() => import("@/components/admin/propostas-nativas/ProposalFunnelDashboard"));
const SystemHealthPage = lazy(() => import("@/components/admin/SystemHealthPage"));
const CronJobsPage = lazy(() => import("@/components/admin/CronJobsPage"));
const AsaasIntegrationPage = lazy(() => import("@/pages/admin/AsaasIntegrationPage"));
const PlanoServicoManager = lazy(() => import("@/components/admin/PlanoServicoManager"));
const ClientPlansPage = lazy(() => import("@/pages/admin/ClientPlansPage"));
const AsaasConversionPage = lazy(() => import("@/pages/admin/AsaasConversionPage"));
const EdeltecIntegrationPage = lazy(() => import("@/pages/admin/EdeltecIntegrationPage"));
const PricingDashboardPage = lazy(() => import("@/pages/admin/PricingDashboardPage"));
const ProjetosManagerPage = lazy(() => import("@/components/admin/projetos").then(m => ({ default: m.ProjetosManager })));
const PostSaleDashboardPage = lazy(() => import("@/components/admin/post-sale/PostSaleDashboard"));
const PostSaleVisitsPage = lazy(() => import("@/components/admin/post-sale/PostSaleVisitsList"));
const PostSalePlansPage = lazy(() => import("@/components/admin/post-sale/PostSalePlansList"));
const PostSaleUpsellPage = lazy(() => import("@/components/admin/post-sale/PostSaleUpsellList"));
const PostSaleVisitDetailPage = lazy(() => import("@/components/admin/post-sale/PostSaleVisitDetail"));
const PostSaleChecklistsPage = lazy(() => import("@/components/admin/post-sale/PostSaleChecklistsPage"));
// Atendimento consolidado no WaInbox
const ProposalWizardPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalWizard")
    .then((m) => ({ default: m.ProposalWizard }))
    .catch((err) => {
      console.error("[ProposalWizard] Lazy load failed:", err);
      // Auto-reload on stale chunk errors (deployment cache)
      if (String(err?.message || "").includes("dynamically imported module")) {
        window.location.reload();
        return { default: () => null };
      }
      return {
        default: () => (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
            <p className="text-destructive font-semibold">Erro ao carregar o Wizard de Propostas</p>
            <p className="text-sm text-muted-foreground max-w-md">{String(err?.message || err)}</p>
            <a onClick={() => window.location.reload()} className="text-sm text-primary underline cursor-pointer">Recarregar página</a>
          </div>
        ),
      };
    })
);

/** Wrapper to read ?conversation= query param for admin inbox */
function WaInboxWithParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialId] = React.useState(() => {
    const convId = searchParams.get("conversation");
    return convId ? convId + ":" + Date.now() : null;
  });

  React.useEffect(() => {
    if (searchParams.get("conversation")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  return <WaInbox initialConversationId={initialId} />;
}

// Error Boundary to catch runtime crashes in ProposalWizard
class ProposalWizardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ProposalWizard] Runtime crash:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
          <p className="text-destructive font-semibold text-lg">Erro ao abrir o Wizard de Propostas</p>
          <p className="text-sm text-muted-foreground max-w-lg">{this.state.error?.message || "Erro desconhecido"}</p>
          <pre className="text-xs text-muted-foreground max-w-lg overflow-auto bg-muted p-3 rounded-md max-h-40">
            {this.state.error?.stack?.slice(0, 500)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm text-primary underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// SolarWizardPage removed — was a mock prototype, ProposalWizard is the real engine


const ProposalDetailPage = lazy(() =>
  import("@/components/admin/propostas-nativas/ProposalDetail").then((m) => ({
    default: m.ProposalDetail,
  }))
);

const VariaveisCustomPage = lazy(() =>
  import("@/components/admin/propostas-nativas/VariaveisCustomManager").then((m) => ({
    default: m.VariaveisCustomManager,
  }))
);


const ALLOWED_ADMIN_ROLES = ["admin", "gerente", "financeiro"];

const TAB_TITLES: Record<string, string> = {
  "meu-painel": "Meu Painel",
  dashboard: "Painel geral",
  inteligencia: "Inteligência comercial",
  diretor: "Assistente IA",
  auditoria: "Registro de atividades",
  leads: "Leads",
  pipeline: "Funil comercial",
  distribuicao: "Distribuição de leads",
  "sla-breaches": "Alertas de prazo",
  "motivos-perda": "Motivos de perda",
  "origens-lead": "Origens de lead",
  inbox: "Atendimento",
  "respostas-rapidas": "Respostas rápidas",
  followup: "Acompanhamentos",
  validacao: "Aprovação de vendas",
  tarefas: "Tarefas & prazos",
  clientes: "Clientes",
  checklists: "Documentação",
  avaliacoes: "Satisfação (NPS)",
  instaladores: "Equipe técnica",
  servicos: "Agenda de serviços",
  "visitas-tecnicas": "Visitas técnicas",
  "financeiro-dashboard": "Financeiro",
  lancamentos: "Lançamentos Financeiros",
  dre: "DRE",
  recebimentos: "Contas a receber",
  inadimplencia: "Inadimplência",
  comissoes: "Comissões",
  engenharia: "Premissas", // redirecionado para premissas > tributação
  financiamento: "Financiamentos",
  "site-config": "Conteúdo & visual",
  brand: "Conteúdo & visual",
  "site-servicos": "Serviços do site",
  obras: "Portfólio",
  aprovacao: "Solicitações de acesso",
  vendedores: "Consultores",
  usuarios: "Usuários & permissões",
  gamificacao: "Metas & ranking",
  "lead-status": "Etapas do funil",
  equipamentos: "Disjuntores & transf.",
  modulos: "Módulos fotovoltaicos",
  "inversores-cadastro": "Inversores",
  baterias: "Baterias",
  concessionarias: "Concessionárias",
  config: "Calculadora solar",
  whatsapp: "WhatsApp API",
  instagram: "Instagram",
  webhooks: "Webhooks",
  n8n: "Automações",
  automacoes: "Central de Automações",
  
  "wa-instances": "Instâncias WhatsApp",
  release: "Checklist de versão",
  propostas: "Propostas comerciais",
  projetos: "Projetos",
  "propostas/novo": "Nova proposta",
  "propostas-nativas/nova": "Nova proposta",
  "propostas-nativas/templates": "Templates de proposta",
  "propostas-nativas/variaveis": "Variáveis customizadas",
  "followup-wa": "Regras de retorno",
  "regras-retorno": "Regras de retorno",
  "followup-queue": "Fila de retorno",
  "followup-wa-queue": "Fila de retorno",
  "metricas-atendimento": "Métricas de atendimento",
  "wa-etiquetas": "Etiquetas WhatsApp",
  "links-instalacao": "Captação & app",
  documentos: "Documentos & assinatura",
  "documentos-assinaturas": "Documentos & assinatura",
  "data-reset": "Manutenção de dados",
  "backup": "Backup de Dados",
  "integracoes": "Integrações",
  "aneel": "Integração ANEEL",
  "pos-venda": "Dashboard pós-venda",
  "pos-venda-visitas": "Preventivas",
  "pos-venda-planos": "Planos pós-venda",
  "pos-venda-upsell": "Oportunidades",
  "pos-venda-checklists": "Checklists pós-venda",

  "payment-gateway": "Pagamentos (Asaas)",
  "ai-config": "Configuração de IA",
  "proposta-comercial": "Proposta Comercial",
  changelog: "Atualizações do sistema",
  "notificacoes-config": "Notificações",
  "loading-config": "Personalização visual",
  "tenant-settings": "Empresa",
  "monitoramento-solar": "Monitoramento Solar",
  "conf-solar": "Premissas solar",
  "variaveis-sistema": "Variáveis do Sistema",
  "pricing-policy": "Política de precificação",
  "politica-precos": "Política de precificação",
  "custom-fields": "Campos customizados",
  menus: "Personalizar menu",
  dev: "Ferramentas dev",
  "cron-jobs": "Tarefas Agendadas",
  "dicionario-aneel": "Dicionário ANEEL",
  "tarifa-versoes": "Versões de tarifa",
  "saude-tarifaria": "Saúde tarifária",
  "aneel-sync-status": "Status do Sync ANEEL",
  medidores: "Medidores",
  ucs: "Unidades Consumidoras",
  "faturas-energia": "Faturas de Energia",
  "central-extracao": "Central de Extração",
  // "gd-rateio" removida — funcionalidade na aba Beneficiárias da UC
  "alertas-energia": "Alertas Energéticos",
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
  useNewLeadAlert();
  useProposalViewAlert();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Derive active tab from URL path
  const activeTab = useMemo(() => {
    const path = location.pathname.replace("/admin/", "").replace("/admin", "");
    const segments = path.split("/").filter(Boolean);
    // For nested modules (e.g. monitoramento/usinas), try 2-segment match first
    if (segments.length >= 2) {
      const twoSegment = `${segments[0]}/${segments[1]}`;
      // Check if this is a registered nav_key (e.g. monitoramento/usinas)
      const knownTwoSegments = ["monitoramento/usinas", "monitoramento/alertas", "monitoramento/relatorios"];
      if (knownTwoSegments.includes(twoSegment)) return twoSegment;
    }
    return segments[0] || "leads";
  }, [location.pathname]);
  const isInboxLayout = activeTab === "inbox";

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
            <h2 className="text-xl font-bold">Acesso Negado</h2>
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
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className={`${isInboxLayout ? "h-[100dvh] overflow-hidden" : "min-h-screen"} flex w-full bg-background`}>
        <GlobalSearch />
        <AdminSidebar
          activeTab={activeTab}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          badgeCounts={badgeCounts}
        />
        <SidebarResizer min={220} max={480} />
        
        <SidebarInset className={`${isInboxLayout ? "h-[100dvh] overflow-hidden" : ""} flex-1 min-w-0 bg-background`}>
          <header className="sticky top-0 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-background/80 backdrop-blur-md border-b border-border/40">
            <SidebarTrigger className="-ml-1 h-8 w-8 shrink-0">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <div className="flex items-center min-w-0 flex-1">
              <AdminBreadcrumb activeTab={activeTab} />
            </div>

            {/* Right-aligned actions — hide less important on mobile */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <span className="hidden md:inline-flex"><HeaderSearch /></span>
              <HelpDropdown onOpenHelpCenter={() => setHelpOpen(true)} />
              <NotificationsDropdown />
              <AgendaSheet />
              <div className="h-4 w-px bg-border/40 mx-0.5 sm:mx-1 hidden sm:block" />
              <ProfileDropdown userEmail={user?.email} onSignOut={handleSignOut} />
            </div>
          </header>

          <SistemaInstallBanner />
          <TrialBanner />
          <UpsellBanner />
          <FeatureDiscoveryLayer />
          <main className={`flex-1 admin-content overflow-x-hidden animate-fade-in ${isInboxLayout ? "min-h-0 overflow-y-hidden" : ""}`}>
            <AdminRouteBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Default redirect */}
                <Route index element={<Navigate to="leads" replace />} />
                
                {/* Visão Geral */}
                <Route path="meu-painel" element={<ConsultorDashboard />} />
                <Route path="dashboard" element={<AnalyticsDashboard />} />
                <Route path="performance" element={<PerformanceDashboard />} />
                <Route path="release" element={<ReleaseChecklist />} />
                
                {/* Comercial */}
                <Route path="leads" element={<LeadsView />} />
                <Route path="pipeline" element={<LeadsPipeline />} />
                <Route path="followup" element={<FollowUpManager diasAlerta={3} />} />
                <Route path="lixeira" element={<LeadsTrashPage />} />
                <Route path="propostas" element={<PropostasManager />} />
                <Route path="projetos" element={<ProjetosManagerPage />} />
                <Route path="propostas-nativas/nova" element={<ProposalWizardErrorBoundary><ProposalWizardPage /></ProposalWizardErrorBoundary>} />
                <Route path="propostas/novo" element={<Navigate to="/admin/propostas-nativas/nova" replace />} />
                <Route path="propostas-nativas/templates" element={<Navigate to="/admin/proposta-comercial?tab=modelos-proposta" replace />} />
                <Route path="propostas-nativas/variaveis" element={<VariaveisCustomPage />} />
                <Route path="propostas-nativas/:propostaId/versoes/:versaoId" element={<ProposalDetailPage />} />
                <Route path="aprovacao" element={<AprovacaoUsuarios />} />
                <Route path="lead-status" element={<LeadStatusManager />} />
                <Route path="inteligencia" element={<IntelligenceDashboard />} />
                <Route path="inteligencia-config" element={<IntelligenceConfigPage />} />
                <Route path="inteligencia-metricas" element={<IntelligenceMetricsPage />} />
                <Route path="inteligencia-alertas" element={<IntelligenceAlertsPage />} />
                <Route path="distribuicao" element={<DistributionConfig />} />
                <Route path="sla-breaches" element={<SlaBreachDashboard />} />
                <Route path="motivos-perda" element={<MotivoPerdaManager />} />
                <Route path="origens-lead" element={<LeadOrigensManager />} />
                
                {/* Atendimento */}
                <Route path="inbox" element={<WaInboxWithParams />} />
                {/* Rotas de atendimento consolidadas no inbox */}
                <Route path="respostas-rapidas" element={<WaQuickRepliesManager />} />
                <Route path="followup-wa" element={<WaFollowupRulesManager />} />
                <Route path="regras-retorno" element={<Navigate to="/admin/followup-wa" replace />} />
                <Route path="followup-queue" element={<WaFollowupQueuePage />} />
                <Route path="followup-wa-queue" element={<Navigate to="/admin/followup-queue" replace />} />
                <Route path="metricas-atendimento" element={<WaAtendimentoMetrics />} />
                <Route path="wa-health" element={<WaHealthDashboard />} />
                <Route path="auditoria-telefones" element={<AuditoriaTelefonesPage />} />
                <Route path="whatsapp/saude" element={<WaSaudePage />} />
                <Route path="wa-etiquetas" element={<WaTagsManager />} />
                <Route path="contatos" element={<ContactsPage />} />
                <Route path="validacao" element={<ValidacaoVendasManager />} />
                <Route path="tarefas" element={<TasksSlaDashboard />} />
                
                {/* Clientes */}
                <Route path="clientes" element={<ClientesManager />} />
                <Route path="checklists" element={<ChecklistsManager />} />
                <Route path="avaliacoes" element={<AvaliacoesManager />} />
                <Route path="servicos" element={<ServicosManager />} />
                <Route path="visitas-tecnicas" element={<VisitasCalendario />} />
                <Route path="documentos" element={<DocumentosPage />} />
                <Route path="documentos-assinaturas" element={<DocumentosPage />} />
                
                {/* Pós-Venda */}
                <Route path="pos-venda" element={<PostSaleDashboardPage />} />
                <Route path="pos-venda-visitas" element={<PostSaleVisitsPage />} />
                <Route path="pos-venda-visitas/:id" element={<PostSaleVisitDetailPage />} />
                <Route path="pos-venda-planos" element={<PostSalePlansPage />} />
                <Route path="pos-venda-upsell" element={<PostSaleUpsellPage />} />
                <Route path="pos-venda-checklists" element={<PostSaleChecklistsPage />} />

                {/* Operações */}
                <Route path="instaladores" element={<InstaladorManager />} />
                <Route path="estoque" element={<EstoquePage />} />
                <Route path="depositos" element={<DepositosPage />} />
                <Route path="categorias-estoque" element={<CategoriasEstoquePage />} />
                <Route path="suprimentos" element={<SuprimentosListPage />} />
                <Route path="suprimentos/:id" element={<OrdemCompraDetalhePage />} />
                
                {/* Medidores */}
                <Route path="medidores" element={<MetersListPage />} />
                <Route path="medidores/:id" element={<MeterDetailPage />} />
                
                {/* Faturas de Energia */}
                <Route path="faturas-energia" element={<FaturasEnergiaPage />} />
                <Route path="faturas-energia/revisao" element={<InvoiceReviewPage />} />
                <Route path="central-extracao" element={<ExtractionCenterPage />} />
                {/* gd-rateio removida — funcionalidade na aba Beneficiárias da UC */}
                <Route path="alertas-energia" element={<EnergyAlertsPage />} />
                <Route path="energia-dashboard" element={<EnergiaDashboard />} />
                <Route path="automacoes-energia" element={<GdAutomationPage />} />
                <Route path="financeiro-energia" element={<EnergyFinancialPage />} />
                <Route path="painel-cliente-energia" element={<ClienteEnergiaDashboardPage />} />
                <Route path="integracoes-email" element={<EmailIntegrationsPage />} />
                
                {/* Unidades Consumidoras */}
                <Route path="ucs" element={<UCsListPage />} />
                <Route path="ucs/:id" element={<UCDetailPage />} />
                
                {/* Financeiro */}
                <Route path="financeiro-dashboard" element={<FinanceiroDashboard />} />
                <Route path="lancamentos" element={<LancamentosPage />} />
                <Route path="recebimentos" element={<RecebimentosManager />} />
                <Route path="inadimplencia" element={<InadimplenciaDashboard />} />
                <Route path="comissoes" element={<ComissoesManager />} />
                <Route path="fechamento-caixa" element={<FechamentoCaixaPage />} />
                <Route path="dre" element={<DREPage />} />
                <Route path="engenharia" element={<Navigate to="/admin/premissas" replace />} />
                <Route path="financiamento" element={<FinanciamentoConfig />} />
                <Route path="formas-pagamento" element={<FormasPagamentoPage />} />
                <Route path="fiscal" element={<FiscalPage />} />
                
                {/* Cadastros */}
                <Route path="vendedores" element={<VendedoresManager />} />
                <Route path="usuarios" element={<UsuariosManager />} />
                <Route path="equipamentos" element={<EquipamentosManager />} />
                <Route path="modulos" element={<EquipmentTabs cadastro={<ModulosManager />} auditoria={<ModulosAuditPage />} />} />
                <Route path="modulos-auditoria" element={<Navigate to="/admin/modulos?tab=auditoria" replace />} />
                <Route path="inversores-cadastro" element={<EquipmentTabs cadastro={<InversoresManager />} auditoria={<InversoresAuditPage />} />} />
                <Route path="inversores-auditoria" element={<Navigate to="/admin/inversores-cadastro?tab=auditoria" replace />} />
                <Route path="baterias" element={<EquipmentTabs cadastro={<BateriasManager />} auditoria={<BateriasAuditPage />} />} />
                <Route path="baterias-auditoria" element={<Navigate to="/admin/baterias?tab=auditoria" replace />} />
                <Route path="otimizadores" element={<EquipmentTabs cadastro={<OtimizadoresManager />} auditoria={<OtimizadoresAuditPage />} />} />
                <Route path="otimizadores-auditoria" element={<Navigate to="/admin/otimizadores?tab=auditoria" replace />} />
                <Route path="fornecedores" element={<FornecedoresManager />} />
                <Route path="concessionarias" element={<ConcessionariasManager />} />
                <Route path="dicionario-aneel" element={<DicionarioAneelPage />} />
                <Route path="tarifa-versoes" element={<TarifaVersoesPage />} />
                <Route path="saude-tarifaria" element={<SaudeTarifariaPage />} />
                <Route path="aneel-sync-status" element={<AneelSyncStatusPage />} />
                <Route path="config" element={<CalculadoraConfig />} />
                <Route path="conf-solar" element={<ConfSolarPage />} />
                <Route path="variaveis-sistema" element={<Navigate to="/admin/proposta-comercial" replace />} />
                <Route path="mensagens-proposta" element={<Suspense fallback={<LoadingSpinner />}><ProposalMessageConfigPage /></Suspense>} />
                <Route path="premissas" element={<PremissasPage />} />
                <Route path="irradiancia" element={<Navigate to="/admin/meteorologia" replace />} />
                <Route path="insumos-irradiacao" element={<Navigate to="/admin/meteorologia" replace />} />
                <Route path="base-meteorologica" element={<Navigate to="/admin/meteorologia" replace />} />
                <Route path="meteorologia" element={<BaseMeteorologicaPage />} />
                <Route path="pricing-policy" element={<PricingPolicyPage />} />
                <Route path="politica-precos" element={<Navigate to="/admin/pricing-policy" replace />} />
                <Route path="gamificacao" element={<GamificacaoConfig />} />
                <Route path="loading-config" element={<LoadingConfigAdmin />} />
                {/* agenda-config removed */}
                
                {/* Projetos & Propostas */}
                <Route path="proposta-comercial" element={<PropostaComercialPage />} />
                
                {/* IA */}
                <Route path="diretor" element={<CommercialDirectorDashboard />} />
                
                {/* Integrações */}
                <Route path="wa-instances" element={<Navigate to="/admin/catalogo-integracoes?tab=instancias" replace />} />
                <Route path="whatsapp" element={<Navigate to="/admin/catalogo-integracoes?tab=automacao" replace />} />
                <Route path="instagram" element={<Navigate to="/admin/catalogo-integracoes" replace />} />
                
                <Route path="webhooks" element={<Navigate to="/admin/catalogo-integracoes?tab=webhooks" replace />} />
                <Route path="n8n" element={<N8nPlaceholder />} />
                <Route path="automacoes" element={<AutomacoesPage />} />
                <Route path="integracoes" element={<Navigate to="/admin/catalogo-integracoes" replace />} />
                <Route path="aneel" element={<Navigate to="/admin/concessionarias" replace />} />
                <Route path="saude-integracoes" element={<Navigate to="/admin/catalogo-integracoes?tab=saude" replace />} />
                <Route path="monitoramento-solar" element={<Navigate to="/admin/monitoramento/integracoes" replace />} />
                <Route path="monitoramento/*" element={<MonitoringModule />} />
                <Route path="catalogo-integracoes" element={<IntegrationsCatalogPage />} />
                <Route path="integracoes/edeltec" element={<EdeltecIntegrationPage />} />
                <Route path="payment-gateway" element={<PaymentGatewayConfigPage />} />
                <Route path="integracao-asaas" element={<AsaasIntegrationPage />} />
                <Route path="asaas-conversao" element={<AsaasConversionPage />} />
                <Route path="openai-config" element={<OpenAIConfigPage />} />
                <Route path="gemini-config" element={<GeminiConfigPage />} />
                <Route path="meta-facebook-config" element={<MetaFacebookConfigPage />} />
                <Route path="meta-dashboard" element={<MetaDashboardPage />} />
                <Route path="meta-leads" element={<MetaLeadsPage />} />
                <Route path="meta-campaigns" element={<MetaCampaignsPage />} />
                <Route path="meta-config" element={<Navigate to="/admin/meta-facebook-config" replace />} />
                <Route path="google-maps-config" element={<Navigate to="/admin/catalogo-integracoes" replace />} />
                <Route path="ai-config" element={<AiConfigPage />} />
                
                {/* Site */}
                <Route path="site-config" element={<SiteSettingsUnified />} />
                <Route path="brand" element={<SiteSettingsUnified />} />
                <Route path="site-servicos" element={<SiteServicosManager />} />
                <Route path="obras" element={<ObrasManager />} />
                
                {/* Administração */}
                <Route path="tenant-settings" element={<TenantSettings />} />
                <Route path="custom-fields" element={<CustomFieldsSettings />} />
                <Route path="auditoria" element={<AuditLogsViewer />} />
                <Route path="data-reset" element={<DataResetManager />} />
                <Route path="backup" element={<BackupRestorePage />} />
                <Route path="permissoes" element={<RolePermissionsManager />} />
                <Route path="planos-features" element={<BillingFeaturesPage />} />
                <Route path="planos" element={<ClientPlansPage />} />
                <Route path="planos-servico" element={<PlanoServicoManager />} />
                <Route path="dashboard-comercial" element={<CommercialDashboardPage />} />
                <Route path="funil-propostas" element={<ProposalFunnelDashboard />} />
                <Route path="pricing" element={<PricingDashboardPage />} />
                
                <Route path="canais-captacao" element={<Navigate to="/admin/links-instalacao" replace />} />
                <Route path="links-instalacao" element={<LinksInstalacaoPage isAdminView />} />
                <Route path="changelog" element={<ChangelogViewer />} />
                <Route path="notificacoes-config" element={<NotificationConfigAdmin />} />
                <Route path="menus" element={<MenuConfigPage />} />
                <Route path="dev" element={<DevToolsPage />} />
                <Route path="system-health" element={<SystemHealthPage />} />
                <Route path="cron-jobs" element={<CronJobsPage />} />
                <Route path="dev/seed" element={<DevToolsPage />} />
                <Route path="dev/reset-seed" element={<DevToolsPage />} />
                <Route path="dev/rls-test" element={<RlsTestPage />} />
                {/* Wizard unificado de migração SolarMarket */}
                <Route path="migracao-solarmarket" element={<MigracaoSolarmarket />} />
                <Route path="migracao-solarmarket/mapear" element={<MigracaoStep2Mapear />} />
                <Route path="migracao-solarmarket/custom-fields" element={<MigracaoStep3CustomFields />} />
                <Route path="migracao-solarmarket/migrar" element={<MigracaoStep3Migrar />} />
                {/* Telas antigas — redirecionam para o novo wizard */}
                <Route path="importacao-solarmarket" element={<Navigate to="/admin/migracao-solarmarket" replace />} />
                <Route path="promocao-solarmarket" element={<Navigate to="/admin/migracao-solarmarket" replace />} />
                <Route path="solarmarket-mapeamentos" element={<Navigate to="/admin/migracao-solarmarket" replace />} />
                <Route path="solarmarket-mapping" element={<Navigate to="/admin/migracao-solarmarket/mapear" replace />} />
                <Route path="configuracoes/integracoes/solarmarket" element={<SolarmarketConfigPage />} />
                <Route path="solarmarket-diagnostic" element={<SolarmarketDiagnosticPage />} />

                {/* Aliases — Central de Configurações de Integrações (Fase 1) */}
                {/* Reaproveitam páginas existentes; rotas antigas continuam funcionando. */}
                <Route path="integracoes/whatsapp/saude" element={<WaSaudePage />} />
                <Route path="integracoes/whatsapp/instancias" element={<WhatsappInstanciasPage />} />
                <Route path="integracoes/whatsapp/ia-resolucao" element={<WhatsappIaResolucaoPage />} />
                <Route path="integracoes/whatsapp/auto-respostas" element={<WhatsappAutoRespostasPage />} />
                <Route path="integracoes/whatsapp/follow-up" element={<WhatsappFollowupPage />} />
                <Route path="integracoes/solarmarket/migracao" element={<SolarmarketMigracaoPage />} />
                <Route path="integracoes/solarmarket/configuracoes" element={<SolarmarketConfigPage />} />
                <Route path="integracoes/solarmarket/funis" element={<SolarmarketFunisPage />} />
                <Route path="integracoes/solarmarket/etapas" element={<SolarmarketEtapasPage />} />
                <Route path="integracoes/solarmarket/consultores" element={<SolarmarketConsultoresPage />} />
                <Route path="integracoes/solarmarket/logs" element={<SolarmarketLogsPage />} />
                <Route path="integracoes/ia/provedores" element={<IaProvedoresPage />} />
                <Route path="integracoes/ia/features" element={<IaFeaturesPage />} />
                <Route path="integracoes/ia/lead-scoring" element={<IaLeadScoringPage />} />
                <Route path="integracoes/conexoes/provedores" element={<ConexoesProvedoresPage />} />
                <Route path="integracoes/conexoes/credenciais" element={<ConexoesCredenciaisPage />} />
                <Route path="integracoes/conexoes/jobs" element={<ConexoesJobsPage />} />
                <Route path="integracoes/conexoes/logs" element={<ConexoesLogsPage />} />
                <Route path="integracoes/visao-geral" element={<Navigate to="/admin/catalogo-integracoes?tab=overview" replace />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="leads" replace />} />
              </Routes>
            </Suspense>
            </AdminRouteBoundary>
          </main>
        </SidebarInset>
        <HelpCenterDrawer open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    </SidebarProvider>
  );
}