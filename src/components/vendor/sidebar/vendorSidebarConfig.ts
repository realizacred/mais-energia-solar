import {
  LayoutDashboard,
  MessageCircle,
  ClipboardCheck,
  FileText,
  Smartphone,
  Trophy,
  Bell,
  Link2,
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
  defaultOpen?: boolean;
}

export const VENDOR_SIDEBAR_SECTIONS: VendorSidebarSection[] = [
  {
    label: "Principal",
    labelIcon: LayoutDashboard,
    indicatorBg: "bg-primary",
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
        description: "Resumo de métricas e indicadores",
      },
      {
        id: "whatsapp",
        title: "Atendimento",
        icon: MessageCircle,
        description: "Conversas e mensagens de clientes",
      },
      {
        id: "agenda",
        title: "Agenda",
        icon: ClipboardCheck,
        description: "Compromissos e tarefas do dia",
      },
    ],
  },
  {
    label: "Comercial",
    labelIcon: FileText,
    indicatorBg: "bg-secondary",
    activeClass:
      "bg-secondary/15 text-secondary font-semibold border-l-[3px] border-secondary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-secondary",
    defaultOpen: true,
    items: [
      {
        id: "orcamentos",
        title: "Orçamentos",
        icon: FileText,
        description: "Propostas e simulações enviadas",
      },
      {
        id: "gamificacao",
        title: "Metas & Ranking",
        icon: Trophy,
        description: "Seu desempenho e posição na equipe",
      },
    ],
  },
  {
    label: "Ferramentas",
    labelIcon: Smartphone,
    indicatorBg: "bg-muted-foreground",
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
        description: "Links de captação e instalação do app",
      },
      {
        id: "notificacoes",
        title: "Notificações",
        icon: Bell,
        description: "Seus alertas e avisos",
      },
    ],
  },
];

export const VENDOR_TAB_TITLES: Record<string, string> = {
  dashboard: "Painel",
  whatsapp: "Atendimento",
  agenda: "Agenda",
  orcamentos: "Orçamentos",
  gamificacao: "Metas & Ranking",
  links: "Captação & App",
  notificacoes: "Notificações",
};
