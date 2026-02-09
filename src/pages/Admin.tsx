import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Menu, ShieldAlert, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLeads } from "@/hooks/useLeads";
import { usePendingValidations } from "@/hooks/usePendingValidations";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/sidebar/AdminSidebar";
import { StatsCards } from "@/components/admin/stats/StatsCards";
import { LeadsView } from "@/components/admin/views/LeadsView";
import LeadsPipeline from "@/components/admin/LeadsPipeline";
import FollowUpManager from "@/components/admin/FollowUpManager";
import DashboardCharts from "@/components/admin/DashboardCharts";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import VendedoresManager from "@/components/admin/VendedoresManager";
import CalculadoraConfig from "@/components/admin/CalculadoraConfig";
import FinanciamentoConfig from "@/components/admin/FinanciamentoConfig";
import WebhookManager from "@/components/admin/WebhookManager";
import { ClientesManager } from "@/components/admin/ClientesManager";
import { RecebimentosManager } from "@/components/admin/RecebimentosManager";
import { InstagramConfig } from "@/components/admin/InstagramConfig";
import { UsuariosManager } from "@/components/admin/UsuariosManager";
import { EquipamentosManager } from "@/components/admin/EquipamentosManager";
import { ModulosManager, InversoresManager, BateriasManager } from "@/components/admin/equipamentos";
import { ConcessionariasManager } from "@/components/admin/ConcessionariasManager";
import { GamificacaoConfig } from "@/components/admin/GamificacaoConfig";
import { ComissoesManager } from "@/components/admin/ComissoesManager";
import { ValidacaoVendasManager } from "@/components/admin/ValidacaoVendasManager";
import { PropostasManager } from "@/components/admin/PropostasManager";
import { ChecklistsManager } from "@/components/admin/ChecklistsManager";
import { AvaliacoesManager } from "@/components/admin/AvaliacoesManager";
import { ServicosManager } from "@/components/admin/ServicosManager";
import { InstaladorManager } from "@/components/admin/InstaladorManager";
import { InadimplenciaDashboard } from "@/components/admin/InadimplenciaDashboard";
import { WhatsAppAutomationConfig } from "@/components/admin/WhatsAppAutomationConfig";
import { AprovacaoUsuarios } from "@/components/admin/AprovacaoUsuarios";
import { AuditLogsViewer } from "@/components/admin/AuditLogsViewer";
import { ReleaseChecklist } from "@/components/admin/ReleaseChecklist";
import { ObrasManager } from "@/components/admin/ObrasManager";
import { SiteSettingsUnified } from "@/components/admin/SiteSettingsUnified";
import { SiteServicosManager } from "@/components/admin/SiteServicosManager";
import { LeadStatusManager } from "@/components/admin/LeadStatusManager";
import { IntelligenceDashboard } from "@/components/admin/intelligence";
import { EngenhariaFinanceiraConfig } from "@/components/admin/EngenhariaFinanceiraConfig";
import { CommercialDirectorDashboard } from "@/components/admin/director";
import { SolarMarketManager } from "@/components/admin/SolarMarketManager";
import { TasksSlaDashboard } from "@/components/admin/tasks";
import { WhatsAppInbox } from "@/components/admin/inbox";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { WaQuickRepliesManager } from "@/components/admin/inbox/WaQuickRepliesManager";
import { WaInstancesManager } from "@/components/admin/WaInstancesManager";
import { PendingValidationWidget } from "@/components/admin/widgets/PendingValidationWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Footer from "@/components/layout/Footer";

const ALLOWED_ADMIN_ROLES = ["admin", "gerente", "financeiro"];

const TAB_TITLES: Record<string, string> = {
  // Visão Geral
  dashboard: "Dashboard Executivo",
  inteligencia: "Inteligência Comercial",
  diretor: "Copilot IA",
  auditoria: "Auditoria & Logs",
  // Comercial
  leads: "Gestão de Leads",
  pipeline: "Pipeline de Vendas",
  inbox: "Central de Atendimento",
  followup: "Follow-ups",
  validacao: "Validação de Vendas",
  tarefas: "Tarefas & SLA",
  // Clientes
  clientes: "Gestão de Clientes",
  checklists: "Documentação",
  avaliacoes: "Avaliações",
  // Operações
  instaladores: "Gestão de Instaladores",
  servicos: "Agenda Técnica",
  // Financeiro
  recebimentos: "Controle de Recebimentos",
  inadimplencia: "Inadimplência",
  comissoes: "Gestão de Comissões",
  engenharia: "Engenharia Financeira",
  financiamento: "Bancos & Financiamento",
  // Site & Marketing
  "site-config": "Site Institucional",
  brand: "Site Institucional",
  "site-servicos": "Serviços do Site",
  obras: "Portfólio de Obras",
  // Configurações
  aprovacao: "Aprovações de Acesso",
  vendedores: "Gestão de Vendedores",
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
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState("leads");
  const { user, signOut, loading: authLoading } = useAuth();
  const { leads, statuses, loading, stats, fetchLeads } = useLeads();
  const { pendingCount } = usePendingValidations();
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

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
        const isVendedor = roles?.some(r => r.role === "vendedor");
        if (isVendedor) {
          navigate("/vendedor", { replace: true });
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "leads") {
      fetchLeads();
    }
  };

  if (authLoading || loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gradient-mesh">
        <div className="flex flex-col items-center gap-4 animate-pulse-soft">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Sun className="w-8 h-8 text-primary animate-spin-slow" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gradient-mesh">
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

  const renderContent = () => {
    switch (activeTab) {
      case "aprovacao":
        return <AprovacaoUsuarios />;
      case "diretor":
        return <CommercialDirectorDashboard />;
      case "inteligencia":
        return <IntelligenceDashboard />;
      case "brand":
      case "site-config":
        return <SiteSettingsUnified />;
      case "leads":
        return <LeadsView />;
      case "pipeline":
        return <LeadsPipeline />;
      case "followup":
        return <FollowUpManager diasAlerta={3} />;
      case "validacao":
        return <ValidacaoVendasManager />;
      case "propostas":
        return <PropostasManager />;
      case "tarefas":
        return <TasksSlaDashboard />;
      case "clientes":
        return <ClientesManager />;
      case "recebimentos":
        return <RecebimentosManager />;
      case "dashboard":
        return <AnalyticsDashboard leads={leads} statuses={statuses} />;
      case "vendedores":
        return <VendedoresManager leads={leads} />;
      case "usuarios":
        return <UsuariosManager />;
      case "equipamentos":
        return <EquipamentosManager />;
      case "modulos":
        return <ModulosManager />;
      case "inversores-cadastro":
        return <InversoresManager />;
      case "baterias":
        return <BateriasManager />;
      case "concessionarias":
        return <ConcessionariasManager />;
      case "gamificacao":
        return <GamificacaoConfig />;
      case "comissoes":
        return <ComissoesManager />;
      case "checklists":
        return <ChecklistsManager />;
      case "avaliacoes":
        return <AvaliacoesManager />;
      case "servicos":
        return <ServicosManager />;
      case "instaladores":
        return <InstaladorManager />;
      case "engenharia":
        return <EngenhariaFinanceiraConfig />;
      case "config":
        return <CalculadoraConfig />;
      case "financiamento":
        return <FinanciamentoConfig />;
      case "instagram":
        return <InstagramConfig />;
      case "inbox":
        return <WaInbox />;
      case "respostas-rapidas":
        return <WaQuickRepliesManager />;
      case "wa-instances":
        return <WaInstancesManager />;
      case "whatsapp":
        return <WhatsAppAutomationConfig />;
      case "webhooks":
        return <WebhookManager />;
      case "n8n":
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
      case "inadimplencia":
        return <InadimplenciaDashboard />;
      case "auditoria":
        return <AuditLogsViewer />;
      case "release":
        return <ReleaseChecklist />;
      case "obras":
        return <ObrasManager />;
      case "site-servicos":
        return <SiteServicosManager />;
      case "lead-status":
        return <LeadStatusManager />;
      case "solarmarket":
        return <SolarMarketManager />;
      default:
        return <LeadsView />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          badgeCounts={badgeCounts}
        />
        
        <SidebarInset className="flex-1 min-w-0">
          {/* Premium Admin Header */}
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

          <main className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden animate-fade-in">
            {activeTab === "leads" && (
              <>
                <StatsCards
                  totalLeads={stats.total}
                  totalKwh={stats.totalKwh}
                  uniqueEstados={stats.uniqueEstados}
                />
                <PendingValidationWidget onNavigate={() => handleTabChange("validacao")} />
              </>
            )}
            {activeTab === "dashboard" && (
              <PendingValidationWidget onNavigate={() => handleTabChange("validacao")} />
            )}
            {renderContent()}
          </main>

          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
