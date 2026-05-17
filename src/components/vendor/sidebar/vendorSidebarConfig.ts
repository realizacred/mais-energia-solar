import {
  LayoutDashboard,
  MessageCircle,
  ClipboardCheck,
  FileText,
  Smartphone,
  Trophy,
  Bell,
  Link2,
  CreditCard,
} from "lucide-react";

export interface VendorMenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  separator?: boolean;
}

export interface VendorSidebarSection {
  label: string;
  labelIcon: React.ComponentType<{ className?: string }>;
  items: VendorMenuItem[];
  activeClass: string;
  hoverClass: string;
  labelClass: string;
  indicatorBg: string;
  indicatorClass?: string;
  iconColor?: string;
  defaultOpen?: boolean;
}

export const VENDOR_SIDEBAR_SECTIONS: VendorSidebarSection[] = [
  {
    label: "Navegação",
    labelIcon: LayoutDashboard,
    indicatorBg: "bg-primary",
    indicatorClass: "sidebar-indicator-commercial",
    iconColor: "text-sidebar-commercial",
    activeClass:
      "bg-primary/15 text-primary font-semibold border-l-[3px] border-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-primary",
    defaultOpen: true,
    items: [
      {
        id: "dashboard",
        title: "Painel",
        icon: LayoutDashboard,
        description: "Métricas e resultados",
      },
      {
        id: "whatsapp",
        title: "Atendimento",
        icon: MessageCircle,
        description: "Conversas com clientes",
      },
      {
        id: "orcamentos",
        title: "Leads",
        icon: FileText,
        description: "Oportunidades de venda",
      },
      {
        id: "agenda",
        title: "Agenda",
        icon: ClipboardCheck,
        description: "Tarefas e compromissos",
      },
    ],
  },
  {
    label: "Vendas & Crédito",
    labelIcon: FileText,
    indicatorBg: "bg-secondary",
    indicatorClass: "sidebar-indicator-finance",
    iconColor: "text-sidebar-finance",
    activeClass:
      "bg-secondary/15 text-secondary font-semibold border-l-[3px] border-secondary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-secondary",
    defaultOpen: true,
    items: [
      {
        id: "propostas",
        title: "Minhas Propostas",
        icon: FileText,
        description: "Documentos comerciais",
      },
      {
        id: "credito",
        title: "Crédito & Bancos",
        icon: CreditCard,
        description: "Análise de financiamento",
      },
      {
        id: "gamificacao",
        title: "Metas & Ranking",
        icon: Trophy,
        description: "Seu desempenho",
      },
    ],
  },
  {
    label: "Utilidades",
    labelIcon: Smartphone,
    indicatorBg: "bg-muted-foreground",
    indicatorClass: "sidebar-indicator-settings",
    iconColor: "text-sidebar-settings",
    activeClass:
      "bg-muted-foreground/15 text-muted-foreground font-semibold border-l-[3px] border-muted-foreground",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-muted-foreground",
    defaultOpen: false,
    items: [
      {
        id: "links",
        title: "Captação & App",
        icon: Smartphone,
        description: "Links e instalação",
      },
      {
        id: "notificacoes",
        title: "Notificações",
        icon: Bell,
        description: "Alertas e avisos",
      },
    ],
  },
];

export const VENDOR_TAB_TITLES: Record<string, string> = {
  dashboard: "Painel",
  whatsapp: "Atendimento",
  agenda: "Agenda",
  orcamentos: "Leads",
  propostas: "Minhas Propostas",
  gamificacao: "Metas & Ranking",
  links: "Captação & App",
  notificacoes: "Notificações",
  credito: "Crédito & Bancos",
};
