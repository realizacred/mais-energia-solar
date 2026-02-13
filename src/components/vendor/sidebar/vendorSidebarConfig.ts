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
      "bg-primary/15 text-primary font-semibold border-l-[3px] border-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]",
    hoverClass: "hover:bg-primary/8 hover:text-sidebar-foreground/80",
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
      "bg-secondary/15 text-secondary font-semibold border-l-[3px] border-secondary shadow-[inset_0_0_0_1px_hsl(var(--secondary)/0.08)]",
    hoverClass: "hover:bg-secondary/8 hover:text-sidebar-foreground/80",
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
      "bg-muted-foreground/15 text-muted-foreground font-semibold border-l-[3px] border-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--muted-foreground)/0.08)]",
    hoverClass: "hover:bg-muted-foreground/8 hover:text-sidebar-foreground/80",
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
