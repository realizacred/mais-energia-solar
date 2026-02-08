import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Menu, ShieldAlert, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLeads } from "@/hooks/useLeads";
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
import { ConcessionariasManager } from "@/components/admin/ConcessionariasManager";
import { GamificacaoConfig } from "@/components/admin/GamificacaoConfig";
import { ComissoesManager } from "@/components/admin/ComissoesManager";
import { ValidacaoVendasManager } from "@/components/admin/ValidacaoVendasManager";
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
import { IntelligenceDashboard } from "@/components/admin/intelligence";
import { EngenhariaFinanceiraConfig } from "@/components/admin/EngenhariaFinanceiraConfig";
import { CommercialDirectorDashboard } from "@/components/admin/director";
import { TasksSlaDashboard } from "@/components/admin/tasks";
import { WhatsAppInbox } from "@/components/admin/inbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Footer from "@/components/layout/Footer";

const ALLOWED_ADMIN_ROLES = ["admin", "gerente", "financeiro"];

const TAB_TITLES: Record<string, string> = {
  diretor: "Diretor Comercial IA",
  inteligencia: "Inteligência Comercial",
  leads: "Leads",
  pipeline: "Pipeline de Vendas",
  followup: "Follow-up",
  validacao: "Validação de Vendas",
  tarefas: "Tarefas & SLA",
  clientes: "Gestão de Clientes",
  recebimentos: "Controle de Recebimentos",
  dashboard: "Dashboard Analítico",
  vendedores: "Vendedores",
  usuarios: "Usuários",
  equipamentos: "Equipamentos",
  concessionarias: "Concessionárias",
  gamificacao: "Gamificação",
  comissoes: "Gestão de Comissões",
  checklists: "Registros de Serviço",
  avaliacoes: "Avaliações",
  servicos: "Agendamento de Serviços",
  instaladores: "Instaladores",
  engenharia: "Engenharia Financeira",
  config: "Calculadora Solar",
  financiamento: "Bancos & Financiamento",
  instagram: "Instagram API",
  inbox: "Central WhatsApp",
  whatsapp: "WhatsApp Automação",
  webhooks: "Webhooks",
  n8n: "n8n Automações",
  inadimplencia: "Inadimplência",
  auditoria: "Auditoria",
  aprovacao: "Aprovações de Acesso",
  brand: "Configurações do Site",
  release: "Release Checklist",
  obras: "Obras / Portfólio",
  "site-config": "Configurações do Site",
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState("leads");
  const { user, signOut, loading: authLoading } = useAuth();
  const { leads, statuses, loading, stats, fetchLeads } = useLeads();
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

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
        return <WhatsAppInbox />;
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
              <StatsCards
                totalLeads={stats.total}
                totalKwh={stats.totalKwh}
                uniqueEstados={stats.uniqueEstados}
              />
            )}
            {renderContent()}
          </main>

          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
