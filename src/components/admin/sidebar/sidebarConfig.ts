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
  Calendar,
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
  FileText,
  Bot,
  Cable,
  Smartphone,
  SunMedium,
  Cpu,
  Battery,
  RotateCcw,
  XCircle,
  Tag,
  FileSearch,
  Trash2,
  Activity,
  QrCode,
  History as HistoryIcon,
  FolderKanban,
  MapPin,
  Zap,
} from "lucide-react";

export interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /** Search keywords for sidebar search */
  keywords?: string[];
  /** Renders a thin divider above this item */
  separator?: boolean;
  /** Visual sub-section label rendered above the item */
  subsectionLabel?: string;
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
 * Sidebar enterprise — 12 seções lógicas
 * Ref: docs/SAAS_MENU_ARCHITECTURE.md (aprovado)
 *
 *  1. Dashboard
 *  2. Comercial
 *  3. Conversas
 *  4. Clientes
 *  5. Operações
 *  6. Financeiro
 *  7. Gestão
 *  8. IA
 *  9. Integrações
 * 10. Site
 * 11. Configurações
 * 12. Administração
 */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  // ─── 1. DASHBOARD ─────────────────────────────────────────
  {
    label: "Dashboard",
    labelIcon: BarChart3,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: true,
    items: [
      { id: "dashboard", title: "Dashboard", icon: BarChart3, description: "Visão geral do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores"] },
    ],
  },

  // ─── 2. COMERCIAL (Revenue Core) ─────────────────────────
  {
    label: "Comercial",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: true,
    items: [
      { id: "leads", title: "Leads", icon: Users, description: "Cadastro e gestão de leads", keywords: ["contato", "prospect", "captura", "formulário"] },
      { id: "pipeline", title: "Pipeline", icon: Kanban, description: "Funil de vendas visual", keywords: ["kanban", "etapas", "funil", "conversão"] },
      { id: "projetos", title: "Projetos", icon: FolderKanban, description: "Pipeline de projetos com funil", keywords: ["projeto", "pipeline", "funil", "kanban", "etapa", "proposta"] },
      { id: "followup", title: "Follow-ups", icon: Bell, description: "Acompanhamento de leads", keywords: ["lembrete", "retorno", "agendamento", "tarefa"] },
      { id: "distribuicao", title: "Distribuição", icon: RotateCcw, description: "Regras & fila de leads", keywords: ["fila", "round-robin", "atribuição", "regras"], separator: true },
      { id: "sla-breaches", title: "SLA & Breaches", icon: AlertTriangle, description: "Violações de prazo", keywords: ["prazo", "atraso", "violação", "alerta"] },
      { id: "inteligencia", title: "Inteligência Comercial", icon: Brain, description: "Scoring & Previsão", keywords: ["score", "previsão", "IA", "análise", "ranking"], separator: true },
    ],
  },

  // ─── 3. CONVERSAS (Revenue Core) ──────────────────────────
  {
    label: "Conversas",
    labelIcon: MessageCircle,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: true,
    items: [
      { id: "inbox", title: "Central WhatsApp", icon: MessageCircle, description: "Inbox de atendimento", keywords: ["chat", "mensagem", "conversa", "WhatsApp"] },
      { id: "followup-queue", title: "Fila de Follow-ups", icon: CalendarClock, description: "Acompanhar follow-ups pendentes", keywords: ["pendente", "fila", "aguardando", "retorno"] },
      { id: "followup-wa", title: "Follow-up WhatsApp", icon: Bell, description: "Regras de acompanhamento WA", keywords: ["automação", "regra", "configurar", "agendamento"] },
    ],
  },

  // ─── 4. CLIENTES (Operations) ─────────────────────────────
  {
    label: "Clientes",
    labelIcon: UserCheck,
    indicatorBg: "bg-sidebar-clients",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: true,
    items: [
      { id: "clientes", title: "Gestão de Clientes", icon: UserCheck, description: "Cadastro e documentos", keywords: ["cliente", "contrato", "documentação", "CPF"] },
      { id: "checklists", title: "Documentação", icon: ClipboardList, description: "Checklists de projeto", keywords: ["checklist", "documento", "verificação", "projeto"] },
      { id: "avaliacoes", title: "Avaliações", icon: Star, description: "NPS — satisfação do cliente (0–10)", keywords: ["NPS", "CSAT", "feedback", "satisfação", "nota", "indicação"] },
      { id: "servicos", title: "Agenda Técnica", icon: CalendarClock, description: "Agendamentos de serviço", keywords: ["agenda", "visita", "instalação", "técnico"] },
    ],
  },

  // ─── 5. OPERAÇÕES ─────────────────────────────────────────
  {
    label: "Operações",
    labelIcon: Wrench,
    indicatorBg: "bg-sidebar-operations",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "instaladores", title: "Instaladores", icon: Wrench, description: "Equipe de campo", keywords: ["técnico", "instalador", "equipe", "campo"] },
      { id: "validacao", title: "Validação", icon: ClipboardCheck, description: "Aprovar vendas realizadas", keywords: ["aprovação", "validar", "conferência"] },
      { id: "tarefas", title: "Tarefas & SLA", icon: ClipboardList, description: "Prazos e pendências", keywords: ["tarefa", "prazo", "SLA", "pendência"] },
    ],
  },

  // ─── 6. FINANCEIRO ────────────────────────────────────────
  {
    label: "Financeiro",
    labelIcon: Wallet,
    indicatorBg: "bg-sidebar-finance",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign, description: "Controle de pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"] },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle, description: "Parcelas atrasadas", keywords: ["atraso", "devedor", "cobrança", "inadimplente"] },
      { id: "comissoes", title: "Comissões", icon: Wallet, description: "Comissões dos consultores", keywords: ["comissão", "consultor", "bonificação", "percentual"] },
      { id: "engenharia", title: "Engenharia Financeira", icon: Calculator, description: "ICMS, fio B, payback", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo"], separator: true },
      { id: "financiamento", title: "Bancos", icon: Building2, description: "Taxas e financiamentos", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"] },
    ],
  },

  // ─── 7. GESTÃO (Administration) ───────────────────────────
  {
    label: "Gestão",
    labelIcon: Users,
    indicatorBg: "bg-sidebar-admin",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "vendedores", title: "Consultores", icon: Users, description: "Cadastro de consultores", keywords: ["consultor", "consultora", "consultores", "equipe", "cadastro"] },
      { id: "aprovacao", title: "Aprovações", icon: ClipboardCheck, description: "Solicitações de acesso", keywords: ["aprovação", "solicitação", "pendente"] },
      { id: "gamificacao", title: "Gamificação", icon: Trophy, description: "Metas e ranking da equipe", keywords: ["meta", "ranking", "conquista", "pontuação", "competição"] },
      { id: "release", title: "Release Notes", icon: Rocket, description: "Checklist de versões", keywords: ["versão", "release", "novidade"] },
    ],
  },

  // ─── 8. IA (Administration) ───────────────────────────────
  {
    label: "IA",
    labelIcon: Bot,
    indicatorBg: "bg-sidebar-ai",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "diretor", title: "Copilot IA", icon: Sparkles, description: "Análise inteligente & sugestões", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência"] },
    ],
  },

  // ─── 9. INTEGRAÇÕES (Administration) ──────────────────────
  {
    label: "Integrações",
    labelIcon: Cable,
    indicatorBg: "bg-sidebar-integrations",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "integracoes", title: "Integrações", icon: Cable, description: "Google Agenda e serviços externos", keywords: ["integração", "google", "calendar", "agenda", "oauth"] },
      { id: "google-maps-config", title: "Google Maps", icon: MapPin, description: "API Key para mapas", keywords: ["google", "maps", "mapa", "api", "geocodificação"] },
      { id: "wa-instances", title: "Instâncias WhatsApp", icon: Smartphone, description: "Evolution API", keywords: ["instância", "evolution", "API", "número"] },
      { id: "whatsapp", title: "WhatsApp API", icon: MessageCircle, description: "Automações de mensagens", keywords: ["API", "automação", "webhook", "bot"] },
      { id: "instagram", title: "Instagram", icon: Instagram, description: "Sincronizar posts", keywords: ["instagram", "post", "rede social", "feed"] },
      { id: "webhooks", title: "Webhooks", icon: Webhook, description: "Integrações externas", keywords: ["webhook", "integração", "API", "n8n"] },
      { id: "n8n", title: "Automações", icon: Workflow, description: "Workflows via MCP", keywords: ["n8n", "automação", "workflow", "MCP"] },
      { id: "ai-config", title: "Configuração de IA", icon: Brain, description: "Modelo, temperatura e gate de follow-up", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência", "artificial", "configuração"] },
    ],
  },

  // ─── 10. SITE (Administration) ────────────────────────────
  {
    label: "Site",
    labelIcon: Globe,
    indicatorBg: "bg-sidebar-admin",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "site-config", title: "Conteúdo & Visual", icon: Globe, description: "Layout e textos do site", keywords: ["site", "landing", "visual", "layout", "marca"] },
      { id: "site-servicos", title: "Serviços", icon: Wrench, description: "Serviços oferecidos", keywords: ["serviço", "oferta", "landing"] },
      { id: "obras", title: "Portfólio", icon: Sun, description: "Projetos realizados", keywords: ["portfólio", "obra", "projeto", "foto"] },
    ],
  },

  // ─── 11. CONFIGURAÇÕES (Administration) ───────────────────
  {
    label: "Configurações",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-settings",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "config", title: "Calculadora Solar", icon: Calculator, description: "Parâmetros de geração e custo", keywords: ["cálculo", "geração", "kWp", "tarifa", "custo"] },
      { id: "lead-status", title: "Status de Leads", icon: Kanban, description: "Personalizar etapas do funil", keywords: ["etapa", "funil", "personalizar", "status"] },
      { id: "motivos-perda", title: "Motivos de Perda", icon: XCircle, description: "Razões de perda de negócios", keywords: ["perda", "motivo", "relatório", "análise"] },
      { id: "respostas-rapidas", title: "Respostas Rápidas", icon: Sparkles, description: "Templates de mensagens", keywords: ["template", "atalho", "mensagem", "rápida"] },
      { id: "wa-etiquetas", title: "Etiquetas WhatsApp", icon: Tag, description: "Tags para conversas", keywords: ["tag", "etiqueta", "classificação", "organizar"] },
      { id: "equipamentos", title: "Disjuntores & Transf.", icon: Plug, description: "Equipamentos elétricos", keywords: ["disjuntor", "transformador", "proteção", "elétrico"], separator: true },
      { id: "modulos", title: "Módulos Fotovoltaicos", icon: SunMedium, description: "Painéis solares disponíveis", keywords: ["painel", "módulo", "solar", "fotovoltaico", "placa"] },
      { id: "inversores-cadastro", title: "Inversores", icon: Cpu, description: "Inversores solares cadastrados", keywords: ["inversor", "potência", "micro-inversor", "string"] },
      { id: "baterias", title: "Baterias", icon: Battery, description: "Sistemas de armazenamento", keywords: ["bateria", "armazenamento", "lítio", "energia"] },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb, description: "Tarifas por distribuidora", keywords: ["tarifa", "distribuidora", "concessionária", "ANEEL"] },
      { id: "dicionario-aneel", title: "Dicionário ANEEL", icon: FileSearch, description: "Mapeamento ANEEL ↔ Concessionárias", keywords: ["aneel", "dicionário", "match", "alias", "mapeamento"] },
      { id: "tarifa-versoes", title: "Versões de Tarifa", icon: HistoryIcon, description: "Versionamento, diff e rollback de tarifas", keywords: ["versão", "tarifa", "rollback", "diff", "histórico", "ativar"] },
      { id: "saude-tarifaria", title: "Saúde Tarifária", icon: Activity, description: "Alertas, cobertura e governança de tarifas", keywords: ["saúde", "alerta", "vigência", "zero", "governança", "diagnóstico"] },
      { id: "aneel-sync-status", title: "Status Sync ANEEL", icon: Zap, description: "Monitoramento em tempo real do sync ANEEL", keywords: ["sync", "aneel", "status", "log", "run", "versão"] },
      { id: "loading-config", title: "Loading & Mensagens", icon: Sun, description: "Animação e mensagens de carregamento", keywords: ["loading", "carregamento", "mensagem", "animação", "sol", "loader"], separator: true },
    ],
  },

  // ─── 12. ADMINISTRAÇÃO ────────────────────────────────────
  {
    label: "Administração",
    labelIcon: Shield,
    indicatorBg: "bg-sidebar-admin",
    activeClass:
      "bg-sidebar-primary/15 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary",
    hoverClass: "hover:bg-sidebar-accent hover:text-sidebar-foreground",
    labelClass: "text-sidebar-foreground/70",
    defaultOpen: false,
    items: [
      { id: "tenant-settings", title: "Empresa", icon: Building2, description: "Identidade, localização e regras de cadastro", keywords: ["empresa", "cnpj", "tenant", "configuração", "crm", "cadastro"] },
      { id: "usuarios", title: "Usuários & Permissões", icon: Shield, description: "Gerenciar acessos e roles", keywords: ["usuário", "permissão", "role", "acesso"] },
      { id: "permissoes", title: "Permissões por Papel", icon: Shield, description: "Configurar acesso de cada papel aos módulos", keywords: ["permissão", "role", "papel", "acesso", "módulo", "gerente", "consultor"] },
      { id: "auditoria", title: "Auditoria (Logs)", icon: FileSearch, description: "Histórico de alterações", keywords: ["log", "auditoria", "histórico", "alteração"] },
      { id: "notificacoes-config", title: "Notificações", icon: Bell, description: "Configurar tipos de notificação da empresa", keywords: ["notificação", "push", "alerta", "configurar", "ativar"], separator: true },
      { id: "links-instalacao", title: "Links & Captação", icon: Smartphone, description: "Links de captação, QR Codes e App PWA", keywords: ["PWA", "link", "instalação", "app", "canal", "captação", "qr", "whatsapp"] },
      { id: "changelog", title: "Atualizações", icon: HistoryIcon, description: "Histórico de atualizações do sistema", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"] },
      { id: "data-reset", title: "Limpeza de Dados", icon: Trash2, description: "Reset seletivo por segmento", keywords: ["reset", "limpeza", "deletar", "remover"] },
    ],
  },
];
