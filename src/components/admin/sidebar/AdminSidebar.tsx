import { Link } from "react-router-dom";
import {
  Brain,
  Users,
  Kanban,
  Bell,
  UserCheck,
  DollarSign,
  BarChart3,
  Calculator,
  Building2,
  Webhook,
  LogOut,
  Sun,
  Instagram,
  Shield,
  Plug,
  Lightbulb,
  Trophy,
  Wallet,
  ClipboardCheck,
  TrendingUp,
  Settings,
  Coins,
  ClipboardList,
  Star,
  CalendarClock,
  Wrench,
  AlertTriangle,
  MessageCircle,
  Cable,
  Workflow,
  Rocket,
  Inbox,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import logo from "@/assets/logo.png";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail?: string;
  onSignOut: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface SidebarSection {
  label: string;
  labelIcon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  activeClass: string;
  hoverClass: string;
  labelClass: string;
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: "Análises",
    labelIcon: BarChart3,
    activeClass: "bg-sidebar-analytics/12 text-sidebar-analytics font-medium border-l-2 border-sidebar-analytics",
    hoverClass: "hover:bg-sidebar-analytics/5",
    labelClass: "text-sidebar-analytics",
    items: [
      { id: "diretor", title: "Diretor Comercial", icon: Brain, description: "IA Copilot" },
      { id: "inteligencia", title: "Inteligência Comercial", icon: Brain, description: "Scoring & Previsão" },
      { id: "dashboard", title: "Dashboard", icon: BarChart3 },
      { id: "auditoria", title: "Auditoria", icon: Shield },
      { id: "release", title: "Release Checklist", icon: Rocket },
    ],
  },
  {
    label: "Site",
    labelIcon: Sun,
    activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-medium border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/5",
    labelClass: "text-sidebar-operations",
    items: [
      { id: "site-config", title: "Configurações do Site", icon: Settings, description: "Conteúdo, visual e banners" },
      { id: "obras", title: "Obras / Portfólio", icon: Sun },
    ],
  },
  {
    label: "Financeiro",
    labelIcon: Coins,
    activeClass: "bg-sidebar-finance/12 text-sidebar-finance font-medium border-l-2 border-sidebar-finance",
    hoverClass: "hover:bg-sidebar-finance/5",
    labelClass: "text-sidebar-finance",
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle },
      { id: "comissoes", title: "Comissões", icon: Wallet },
      { id: "clientes", title: "Clientes", icon: UserCheck },
    ],
  },
  {
    label: "Vendas",
    labelIcon: TrendingUp,
    activeClass: "bg-sidebar-sales/12 text-sidebar-sales font-medium border-l-2 border-sidebar-sales",
    hoverClass: "hover:bg-sidebar-sales/5",
    labelClass: "text-sidebar-sales",
    items: [
      { id: "leads", title: "Leads", icon: Users },
      { id: "pipeline", title: "Pipeline", icon: Kanban },
      { id: "inbox", title: "Central WhatsApp", icon: Inbox, description: "Atendimento" },
      { id: "followup", title: "Follow-up", icon: Bell },
      { id: "validacao", title: "Validar Vendas", icon: ClipboardCheck },
      { id: "tarefas", title: "Tarefas & SLA", icon: ClipboardList, description: "Gestão operacional" },
    ],
  },
  {
    label: "Operações",
    labelIcon: ClipboardList,
    activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-medium border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/5",
    labelClass: "text-sidebar-operations",
    items: [
      { id: "instaladores", title: "Instaladores", icon: Wrench },
      { id: "servicos", title: "Serviços", icon: CalendarClock },
      { id: "checklists", title: "Checklists", icon: ClipboardList },
      { id: "avaliacoes", title: "Avaliações", icon: Star },
    ],
  },
  {
    label: "APIs",
    labelIcon: Cable,
    activeClass: "bg-sidebar-apis/12 text-sidebar-apis font-medium border-l-2 border-sidebar-apis",
    hoverClass: "hover:bg-sidebar-apis/5",
    labelClass: "text-sidebar-apis",
    items: [
      { id: "whatsapp", title: "WhatsApp API", icon: MessageCircle, description: "Evolution API" },
      { id: "instagram", title: "Instagram API", icon: Instagram, description: "Meta Graph API" },
      { id: "webhooks", title: "Webhooks", icon: Webhook, description: "Entrada/Saída" },
      { id: "n8n", title: "n8n", icon: Workflow, description: "Automações" },
    ],
  },
  {
    label: "Configurações",
    labelIcon: Settings,
    activeClass: "bg-sidebar-config/12 text-sidebar-config font-medium border-l-2 border-sidebar-config",
    hoverClass: "hover:bg-sidebar-config/5",
    labelClass: "text-sidebar-config",
    items: [
      { id: "aprovacao", title: "Aprovações", icon: UserCheck },
      { id: "vendedores", title: "Vendedores", icon: Users },
      { id: "usuarios", title: "Usuários", icon: Shield },
      { id: "gamificacao", title: "Gamificação", icon: Trophy },
      { id: "equipamentos", title: "Equipamentos", icon: Plug },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb },
      { id: "engenharia", title: "Engenharia Financeira", icon: Calculator, description: "Fio B / ICMS / Payback" },
      { id: "config", title: "Calculadora", icon: Calculator },
      { id: "financiamento", title: "Bancos", icon: Building2 },
    ],
  },
];

export function AdminSidebar({
  activeTab,
  onTabChange,
  userEmail,
  onSignOut,
}: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30">
      <SidebarHeader className="border-b border-border/30 p-4">
        <Link
          to="/"
          className="flex items-center gap-3 transition-all duration-200 hover:opacity-80"
        >
          {collapsed ? (
            <div className="p-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors">
              <Sun className="h-6 w-6 text-primary" />
            </div>
          ) : (
            <img
              src={logo}
              alt="Mais Energia Solar"
              className="h-9 w-auto"
            />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin px-2 py-3">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarGroup key={section.label} className="mb-0.5">
            <SidebarGroupLabel className={`text-[10px] font-bold uppercase tracking-[0.12em] ${section.labelClass} px-3 py-2.5 flex items-center gap-1.5 opacity-80`}>
              <section.labelIcon className="h-3 w-3" />
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      isActive={activeTab === item.id}
                      tooltip={item.description ? `${item.title} - ${item.description}` : item.title}
                      className={`
                        transition-all duration-200 rounded-lg mx-1 my-px
                        ${activeTab === item.id
                          ? section.activeClass
                          : `text-sidebar-foreground/65 ${section.hoverClass} hover:text-sidebar-foreground`
                        }
                      `}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.description ? (
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-[13px] truncate">{item.title}</span>
                          <span className="text-[10px] opacity-45 font-normal truncate">{item.description}</span>
                        </div>
                      ) : (
                        <span className="text-[13px] truncate">{item.title}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 p-3 space-y-2">
        {!collapsed && userEmail && (
          <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border/20">
            <p className="text-[11px] text-muted-foreground truncate font-medium">{userEmail}</p>
          </div>
        )}
        {!collapsed && <PortalSwitcher />}
        <Button
          variant="outline"
          size={collapsed ? "icon" : "default"}
          onClick={onSignOut}
          className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 rounded-lg transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
