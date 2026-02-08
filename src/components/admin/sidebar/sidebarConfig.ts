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

export interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export interface SidebarSection {
  label: string;
  labelIcon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  /** Tailwind classes applied to the active item */
  activeClass: string;
  /** Tailwind hover classes for inactive items */
  hoverClass: string;
  /** Tailwind classes for the section label text */
  labelClass: string;
  /** Tailwind bg class for the small colored indicator square */
  indicatorBg: string;
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: "Análises",
    labelIcon: BarChart3,
    indicatorBg: "bg-sidebar-analytics",
    activeClass:
      "bg-sidebar-analytics/12 text-sidebar-analytics font-semibold border-l-2 border-sidebar-analytics",
    hoverClass: "hover:bg-sidebar-analytics/6",
    labelClass: "text-sidebar-analytics",
    items: [
      {
        id: "diretor",
        title: "Diretor Comercial",
        icon: Brain,
        description: "IA Copilot",
      },
      {
        id: "inteligencia",
        title: "Inteligência Comercial",
        icon: Brain,
        description: "Scoring & Previsão",
      },
      { id: "dashboard", title: "Dashboard", icon: BarChart3 },
      { id: "auditoria", title: "Auditoria", icon: Shield },
      { id: "release", title: "Release Checklist", icon: Rocket },
    ],
  },
  {
    label: "Vendas",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-sales",
    activeClass:
      "bg-sidebar-sales/12 text-sidebar-sales font-semibold border-l-2 border-sidebar-sales",
    hoverClass: "hover:bg-sidebar-sales/6",
    labelClass: "text-sidebar-sales",
    items: [
      { id: "leads", title: "Leads", icon: Users },
      { id: "pipeline", title: "Pipeline", icon: Kanban },
      {
        id: "inbox",
        title: "Central WhatsApp",
        icon: Inbox,
        description: "Atendimento",
      },
      { id: "followup", title: "Follow-up", icon: Bell },
      {
        id: "validacao",
        title: "Validar Vendas",
        icon: ClipboardCheck,
      },
      {
        id: "tarefas",
        title: "Tarefas & SLA",
        icon: ClipboardList,
        description: "Gestão operacional",
      },
    ],
  },
  {
    label: "Financeiro",
    labelIcon: Coins,
    indicatorBg: "bg-sidebar-finance",
    activeClass:
      "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance",
    hoverClass: "hover:bg-sidebar-finance/6",
    labelClass: "text-sidebar-finance",
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle },
      { id: "comissoes", title: "Comissões", icon: Wallet },
      { id: "clientes", title: "Clientes", icon: UserCheck },
    ],
  },
  {
    label: "Operações",
    labelIcon: ClipboardList,
    indicatorBg: "bg-sidebar-operations",
    activeClass:
      "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/6",
    labelClass: "text-sidebar-operations",
    items: [
      { id: "instaladores", title: "Instaladores", icon: Wrench },
      { id: "servicos", title: "Serviços", icon: CalendarClock },
      { id: "checklists", title: "Checklists", icon: ClipboardList },
      { id: "avaliacoes", title: "Avaliações", icon: Star },
    ],
  },
  {
    label: "Site",
    labelIcon: Sun,
    indicatorBg: "bg-primary",
    activeClass:
      "bg-primary/12 text-primary font-semibold border-l-2 border-primary",
    hoverClass: "hover:bg-primary/6",
    labelClass: "text-primary",
    items: [
      {
        id: "site-config",
        title: "Configurações do Site",
        icon: Settings,
        description: "Conteúdo, visual e banners",
      },
      { id: "obras", title: "Obras / Portfólio", icon: Sun },
    ],
  },
  {
    label: "APIs",
    labelIcon: Cable,
    indicatorBg: "bg-sidebar-apis",
    activeClass:
      "bg-sidebar-apis/12 text-sidebar-apis font-semibold border-l-2 border-sidebar-apis",
    hoverClass: "hover:bg-sidebar-apis/6",
    labelClass: "text-sidebar-apis",
    items: [
      {
        id: "whatsapp",
        title: "WhatsApp API",
        icon: MessageCircle,
        description: "Evolution API",
      },
      {
        id: "instagram",
        title: "Instagram API",
        icon: Instagram,
        description: "Meta Graph API",
      },
      {
        id: "webhooks",
        title: "Webhooks",
        icon: Webhook,
        description: "Entrada/Saída",
      },
      {
        id: "n8n",
        title: "n8n",
        icon: Workflow,
        description: "Automações",
      },
    ],
  },
  {
    label: "Configurações",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-config",
    activeClass:
      "bg-sidebar-config/12 text-sidebar-config font-semibold border-l-2 border-sidebar-config",
    hoverClass: "hover:bg-sidebar-config/6",
    labelClass: "text-sidebar-config",
    items: [
      { id: "aprovacao", title: "Aprovações", icon: UserCheck },
      { id: "vendedores", title: "Vendedores", icon: Users },
      { id: "usuarios", title: "Usuários", icon: Shield },
      { id: "gamificacao", title: "Gamificação", icon: Trophy },
      { id: "equipamentos", title: "Equipamentos", icon: Plug },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb },
      {
        id: "engenharia",
        title: "Engenharia Financeira",
        icon: Calculator,
        description: "Fio B / ICMS / Payback",
      },
      { id: "config", title: "Calculadora", icon: Calculator },
      { id: "financiamento", title: "Bancos", icon: Building2 },
    ],
  },
];
