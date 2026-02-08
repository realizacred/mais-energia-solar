import {
  BarChart3,
  Brain,
  Sparkles,
  Shield,
  Users,
  Kanban,
  MessageCircle,
  Bell,
  ClipboardCheck,
  ClipboardList,
  UserCheck,
  Star,
  Wrench,
  CalendarClock,
  DollarSign,
  AlertTriangle,
  Wallet,
  Calculator,
  Building2,
  Globe,
  Settings,
  Sun,
  Trophy,
  Plug,
  Lightbulb,
  Instagram,
  Webhook,
  Workflow,
  Rocket,
  TrendingUp,
} from "lucide-react";

export interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /** Renders a thin divider above this item */
  separator?: boolean;
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
  /** Whether the section is expanded by default */
  defaultOpen?: boolean;
}

/**
 * Sidebar architecture follows the natural business journey:
 * ANALISAR → VENDER → ATENDER → EXECUTAR → RECEBER → ESCALAR
 *
 * Each section maps to a stage in the lifecycle, reducing
 * cognitive load and telling the story of the business.
 */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  // ─── 1. VISÃO GERAL — Strategic overview ───────────────────
  {
    label: "Visão Geral",
    labelIcon: BarChart3,
    indicatorBg: "bg-sidebar-intelligence",
    activeClass:
      "bg-sidebar-intelligence/12 text-sidebar-intelligence font-semibold border-l-2 border-sidebar-intelligence",
    hoverClass: "hover:bg-sidebar-intelligence/6",
    labelClass: "text-sidebar-intelligence",
    defaultOpen: true,
    items: [
      { id: "dashboard", title: "Dashboard", icon: BarChart3 },
      {
        id: "inteligencia",
        title: "Inteligência Comercial",
        icon: Brain,
        description: "Scoring & Previsão",
      },
      {
        id: "diretor",
        title: "Copilot IA",
        icon: Sparkles,
        description: "Análise inteligente",
      },
      { id: "auditoria", title: "Auditoria", icon: Shield },
    ],
  },

  // ─── 2. COMERCIAL — Core CRM (most prominent) ─────────────
  {
    label: "Comercial",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial",
    hoverClass: "hover:bg-sidebar-commercial/6",
    labelClass: "text-sidebar-commercial",
    defaultOpen: true,
    items: [
      { id: "leads", title: "Leads", icon: Users },
      { id: "pipeline", title: "Pipeline", icon: Kanban },
      {
        id: "inbox",
        title: "Atendimento",
        icon: MessageCircle,
        description: "Central WhatsApp",
      },
      { id: "followup", title: "Follow-ups", icon: Bell },
      { id: "validacao", title: "Validação", icon: ClipboardCheck },
      {
        id: "tarefas",
        title: "Tarefas & SLA",
        icon: ClipboardList,
      },
    ],
  },

  // ─── 3. CLIENTES — Post-sale relationship ──────────────────
  {
    label: "Clientes",
    labelIcon: UserCheck,
    indicatorBg: "bg-sidebar-clients",
    activeClass:
      "bg-sidebar-clients/12 text-sidebar-clients font-semibold border-l-2 border-sidebar-clients",
    hoverClass: "hover:bg-sidebar-clients/6",
    labelClass: "text-sidebar-clients",
    defaultOpen: true,
    items: [
      { id: "clientes", title: "Gestão de Clientes", icon: UserCheck },
      {
        id: "checklists",
        title: "Documentação",
        icon: ClipboardList,
      },
      { id: "avaliacoes", title: "Avaliações", icon: Star },
    ],
  },

  // ─── 4. OPERAÇÕES — Field execution ────────────────────────
  {
    label: "Operações",
    labelIcon: Wrench,
    indicatorBg: "bg-sidebar-operations",
    activeClass:
      "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/6",
    labelClass: "text-sidebar-operations",
    defaultOpen: true,
    items: [
      { id: "instaladores", title: "Instaladores", icon: Wrench },
      {
        id: "servicos",
        title: "Agenda Técnica",
        icon: CalendarClock,
      },
    ],
  },

  // ─── 5. FINANCEIRO — Revenue & trust ───────────────────────
  {
    label: "Financeiro",
    labelIcon: Wallet,
    indicatorBg: "bg-sidebar-finance",
    activeClass:
      "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance",
    hoverClass: "hover:bg-sidebar-finance/6",
    labelClass: "text-sidebar-finance",
    defaultOpen: true,
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle },
      { id: "comissoes", title: "Comissões", icon: Wallet },
      {
        id: "engenharia",
        title: "Engenharia Financeira",
        icon: Calculator,
        description: "Fio B / ICMS / Payback",
      },
      { id: "financiamento", title: "Bancos", icon: Building2 },
    ],
  },

  // ─── 6. SITE & MARKETING — White-label ready ──────────────
  {
    label: "Site & Marketing",
    labelIcon: Globe,
    indicatorBg: "bg-sidebar-marketing",
    activeClass:
      "bg-sidebar-marketing/12 text-sidebar-marketing font-semibold border-l-2 border-sidebar-marketing",
    hoverClass: "hover:bg-sidebar-marketing/6",
    labelClass: "text-sidebar-marketing",
    defaultOpen: false,
    items: [
      {
        id: "site-config",
        title: "Site Institucional",
        icon: Settings,
        description: "Conteúdo & Visual",
      },
      { id: "site-servicos", title: "Serviços", icon: Wrench },
      { id: "obras", title: "Portfólio", icon: Sun },
    ],
  },

  // ─── 7. CONFIGURAÇÕES — System super-menu ─────────────────
  {
    label: "Configurações",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-settings",
    activeClass:
      "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings",
    hoverClass: "hover:bg-sidebar-settings/6",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      // ── Equipe ──
      { id: "aprovacao", title: "Aprovações", icon: UserCheck },
      { id: "vendedores", title: "Vendedores", icon: Users },
      { id: "usuarios", title: "Usuários & Permissões", icon: Shield },
      { id: "gamificacao", title: "Gamificação", icon: Trophy },
      // ── Operacional ──
      {
        id: "lead-status",
        title: "Status de Leads",
        icon: Kanban,
        separator: true,
      },
      { id: "equipamentos", title: "Equipamentos", icon: Plug },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb },
      { id: "config", title: "Calculadora Solar", icon: Calculator },
      // ── Integrações ──
      {
        id: "whatsapp",
        title: "WhatsApp API",
        icon: MessageCircle,
        separator: true,
      },
      { id: "instagram", title: "Instagram", icon: Instagram },
      { id: "webhooks", title: "Webhooks", icon: Webhook },
      { id: "n8n", title: "Automações", icon: Workflow },
      // ── Sistema ──
      {
        id: "release",
        title: "Release Notes",
        icon: Rocket,
        separator: true,
      },
    ],
  },
];
