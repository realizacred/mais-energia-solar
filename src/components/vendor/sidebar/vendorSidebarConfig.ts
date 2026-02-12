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
      "bg-primary/12 text-primary font-semibold border-l-2 border-primary",
    hoverClass: "hover:bg-primary/6",
    labelClass: "text-primary",
    defaultOpen: true,
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        description: "Visão geral de performance",
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        icon: MessageCircle,
        description: "Central de atendimento",
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
    label: "Comercial",
    labelIcon: FileText,
    indicatorBg: "bg-secondary",
    activeClass:
      "bg-secondary/12 text-secondary font-semibold border-l-2 border-secondary",
    hoverClass: "hover:bg-secondary/6",
    labelClass: "text-secondary",
    defaultOpen: true,
    items: [
      {
        id: "orcamentos",
        title: "Orçamentos",
        icon: FileText,
        description: "Leads e propostas",
      },
      {
        id: "gamificacao",
        title: "Gamificação",
        icon: Trophy,
        description: "Metas e ranking",
      },
    ],
  },
  {
    label: "Ferramentas",
    labelIcon: Smartphone,
    indicatorBg: "bg-muted-foreground",
    activeClass:
      "bg-muted-foreground/12 text-muted-foreground font-semibold border-l-2 border-muted-foreground",
    hoverClass: "hover:bg-muted-foreground/6",
    labelClass: "text-muted-foreground",
    defaultOpen: false,
    items: [
      {
        id: "links",
        title: "Links & App",
        icon: Smartphone,
        description: "Instalação PWA e links",
      },
      {
        id: "notificacoes",
        title: "Notificações",
        icon: Bell,
        description: "Configurar alertas",
      },
    ],
  },
];

export const VENDOR_TAB_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  whatsapp: "WhatsApp",
  agenda: "Agenda",
  orcamentos: "Orçamentos",
  gamificacao: "Gamificação & Ranking",
  links: "Links & Instalação",
  notificacoes: "Notificações",
};
