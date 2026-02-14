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
    indicatorBg: "bg-sidebar-intelligence",
    activeClass:
      "bg-sidebar-intelligence/18 text-sidebar-intelligence font-semibold border-l-[3px] border-sidebar-intelligence shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-intelligence)/0.12)]",
    hoverClass: "hover:bg-sidebar-intelligence/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-intelligence",
    defaultOpen: true,
    items: [
      { id: "dashboard", title: "Dashboard", icon: BarChart3, description: "Visão geral do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores"] },
    ],
  },

  // ─── 2. COMERCIAL ─────────────────────────────────────────
  {
    label: "Comercial",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-commercial/18 text-sidebar-commercial font-semibold border-l-[3px] border-sidebar-commercial shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-commercial)/0.12)]",
    hoverClass: "hover:bg-sidebar-commercial/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-commercial",
    defaultOpen: true,
    items: [
      { id: "leads", title: "Leads", icon: Users, description: "Cadastro e gestão de leads", keywords: ["contato", "prospect", "captura", "formulário"] },
      { id: "pipeline", title: "Pipeline", icon: Kanban, description: "Funil de vendas visual", keywords: ["kanban", "etapas", "funil", "conversão"] },
      { id: "propostas", title: "Propostas (SM)", icon: FileText, description: "Importações SolarMarket", keywords: ["orçamento", "cotação", "solarmarket"] },
      { id: "propostas-nativas", title: "Gerador de Propostas", icon: FileText, description: "Criar propostas nativas", keywords: ["proposta", "gerar", "wizard", "lei 14300", "nativa", "cotação"] },
      { id: "projetos", title: "Projetos", icon: FolderKanban, description: "Pipeline de projetos com funil", keywords: ["projeto", "pipeline", "funil", "kanban", "etapa", "proposta"] },
      { id: "followup", title: "Follow-ups", icon: Bell, description: "Acompanhamento de leads", keywords: ["lembrete", "retorno", "agendamento", "tarefa"] },
      { id: "distribuicao", title: "Distribuição", icon: RotateCcw, description: "Regras & fila de leads", keywords: ["fila", "round-robin", "atribuição", "regras"], separator: true },
      { id: "sla-breaches", title: "SLA & Breaches", icon: AlertTriangle, description: "Violações de prazo", keywords: ["prazo", "atraso", "violação", "alerta"] },
      { id: "inteligencia", title: "Inteligência Comercial", icon: Brain, description: "Scoring & Previsão", keywords: ["score", "previsão", "IA", "análise", "ranking"], separator: true },
    ],
  },

  // ─── 3. CONVERSAS ─────────────────────────────────────────
  {
    label: "Conversas",
    labelIcon: MessageCircle,
    indicatorBg: "bg-sidebar-atendimento",
    activeClass:
      "bg-sidebar-atendimento/18 text-sidebar-atendimento font-semibold border-l-[3px] border-sidebar-atendimento shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-atendimento)/0.12)]",
    hoverClass: "hover:bg-sidebar-atendimento/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-atendimento",
    defaultOpen: true,
    items: [
      { id: "inbox", title: "Central WhatsApp", icon: MessageCircle, description: "Inbox de atendimento", keywords: ["chat", "mensagem", "conversa", "WhatsApp"] },
      { id: "followup-queue", title: "Fila de Follow-ups", icon: CalendarClock, description: "Acompanhar follow-ups pendentes", keywords: ["pendente", "fila", "aguardando", "retorno"] },
      { id: "followup-wa", title: "Follow-up WhatsApp", icon: Bell, description: "Regras de acompanhamento WA", keywords: ["automação", "regra", "configurar", "agendamento"] },
    ],
  },

  // ─── 4. CLIENTES ──────────────────────────────────────────
  {
    label: "Clientes",
    labelIcon: UserCheck,
    indicatorBg: "bg-sidebar-clients",
    activeClass:
      "bg-sidebar-clients/18 text-sidebar-clients font-semibold border-l-[3px] border-sidebar-clients shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-clients)/0.12)]",
    hoverClass: "hover:bg-sidebar-clients/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-clients",
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
      "bg-sidebar-operations/18 text-sidebar-operations font-semibold border-l-[3px] border-sidebar-operations shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-operations)/0.12)]",
    hoverClass: "hover:bg-sidebar-operations/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-operations",
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
      "bg-sidebar-finance/18 text-sidebar-finance font-semibold border-l-[3px] border-sidebar-finance shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-finance)/0.12)]",
    hoverClass: "hover:bg-sidebar-finance/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-finance",
    defaultOpen: false,
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign, description: "Controle de pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"] },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle, description: "Parcelas atrasadas", keywords: ["atraso", "devedor", "cobrança", "inadimplente"] },
      { id: "comissoes", title: "Comissões", icon: Wallet, description: "Comissões dos consultores", keywords: ["comissão", "vendedor", "bonificação", "percentual"] },
      { id: "engenharia", title: "Engenharia Financeira", icon: Calculator, description: "ICMS, fio B, payback", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo"], separator: true },
      { id: "financiamento", title: "Bancos", icon: Building2, description: "Taxas e financiamentos", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"] },
    ],
  },

  // ─── 7. GESTÃO ────────────────────────────────────────────
  {
    label: "Gestão",
    labelIcon: Users,
    indicatorBg: "bg-sidebar-cadastros",
    activeClass:
      "bg-sidebar-cadastros/18 text-sidebar-cadastros font-semibold border-l-[3px] border-sidebar-cadastros shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-cadastros)/0.12)]",
    hoverClass: "hover:bg-sidebar-cadastros/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-cadastros",
    defaultOpen: false,
    items: [
      { id: "vendedores", title: "Consultores", icon: Users, description: "Cadastro de consultores", keywords: ["consultor", "vendedor", "equipe", "cadastro"] },
      
      { id: "aprovacao", title: "Aprovações", icon: ClipboardCheck, description: "Solicitações de acesso", keywords: ["aprovação", "solicitação", "pendente"] },
      { id: "gamificacao", title: "Gamificação", icon: Trophy, description: "Metas e ranking da equipe", keywords: ["meta", "ranking", "conquista", "pontuação", "competição"] },
      { id: "release", title: "Release Notes", icon: Rocket, description: "Checklist de versões", keywords: ["versão", "release", "novidade"] },
    ],
  },

  // ─── 8. IA ────────────────────────────────────────────────
  {
    label: "IA",
    labelIcon: Bot,
    indicatorBg: "bg-sidebar-ai",
    activeClass:
      "bg-sidebar-ai/18 text-sidebar-ai font-semibold border-l-[3px] border-sidebar-ai shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-ai)/0.12)]",
    hoverClass: "hover:bg-sidebar-ai/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-ai",
    defaultOpen: false,
    items: [
      { id: "diretor", title: "Copilot IA", icon: Sparkles, description: "Análise inteligente & sugestões", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência"] },
    ],
  },

  // ─── 9. INTEGRAÇÕES ───────────────────────────────────────
  {
    label: "Integrações",
    labelIcon: Cable,
    indicatorBg: "bg-sidebar-integrations",
    activeClass:
      "bg-sidebar-integrations/18 text-sidebar-integrations font-semibold border-l-[3px] border-sidebar-integrations shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-integrations)/0.12)]",
    hoverClass: "hover:bg-sidebar-integrations/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-integrations",
    defaultOpen: false,
    items: [
      { id: "integracoes-status", title: "Status das Integrações", icon: Activity, description: "Health check de todas as APIs", keywords: ["status", "health", "integração", "API", "monitoramento"] },
      { id: "wa-instances", title: "Instâncias WhatsApp", icon: Smartphone, description: "Evolution API", keywords: ["instância", "evolution", "API", "número"] },
      { id: "whatsapp", title: "WhatsApp API", icon: MessageCircle, description: "Automações de mensagens", keywords: ["API", "automação", "webhook", "bot"] },
      { id: "instagram", title: "Instagram", icon: Instagram, description: "Sincronizar posts", keywords: ["instagram", "post", "rede social", "feed"] },
      { id: "solarmarket", title: "SolarMarket", icon: Sun, description: "Marketplace solar", keywords: ["marketplace", "solar", "integração"] },
      { id: "webhooks", title: "Webhooks", icon: Webhook, description: "Integrações externas", keywords: ["webhook", "integração", "API", "n8n"] },
      { id: "n8n", title: "Automações", icon: Workflow, description: "Workflows via MCP", keywords: ["n8n", "automação", "workflow", "MCP"] },
      // google-calendar unified into agenda-config
      { id: "ai-config", title: "Configuração de IA", icon: Brain, description: "Modelo, temperatura e gate de follow-up", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência", "artificial", "configuração"] },
    ],
  },

  // ─── 10. SITE ─────────────────────────────────────────────
  {
    label: "Site",
    labelIcon: Globe,
    indicatorBg: "bg-sidebar-marketing",
    activeClass:
      "bg-sidebar-marketing/18 text-sidebar-marketing font-semibold border-l-[3px] border-sidebar-marketing shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-marketing)/0.12)]",
    hoverClass: "hover:bg-sidebar-marketing/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-marketing",
    defaultOpen: false,
    items: [
      { id: "site-config", title: "Conteúdo & Visual", icon: Globe, description: "Layout e textos do site", keywords: ["site", "landing", "visual", "layout", "marca"] },
      { id: "site-servicos", title: "Serviços", icon: Wrench, description: "Serviços oferecidos", keywords: ["serviço", "oferta", "landing"] },
      { id: "obras", title: "Portfólio", icon: Sun, description: "Projetos realizados", keywords: ["portfólio", "obra", "projeto", "foto"] },
    ],
  },

  // ─── 11. CONFIGURAÇÕES ────────────────────────────────────
  {
    label: "Configurações",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-cadastros",
    activeClass:
      "bg-sidebar-cadastros/18 text-sidebar-cadastros font-semibold border-l-[3px] border-sidebar-cadastros shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-cadastros)/0.12)]",
    hoverClass: "hover:bg-sidebar-cadastros/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-cadastros",
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
      { id: "agenda-config", title: "Agenda & Compromissos", icon: Calendar, description: "Configurar agenda interna e Google Calendar", keywords: ["agenda", "compromisso", "google", "calendar", "agendamento"], separator: true },
      { id: "loading-config", title: "Loading & Mensagens", icon: Sun, description: "Animação e mensagens de carregamento", keywords: ["loading", "carregamento", "mensagem", "animação", "sol", "loader"], separator: true },
    ],
  },

  // ─── 12. ADMINISTRAÇÃO ────────────────────────────────────
  {
    label: "Administração",
    labelIcon: Shield,
    indicatorBg: "bg-sidebar-settings",
    activeClass:
      "bg-sidebar-settings/18 text-sidebar-settings font-semibold border-l-[3px] border-sidebar-settings shadow-[inset_0_0_0_1px_hsl(var(--sidebar-section-settings)/0.12)]",
    hoverClass: "hover:bg-sidebar-settings/12 hover:text-sidebar-foreground/90",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      { id: "tenant-settings", title: "Empresa", icon: Building2, description: "Identidade, localização e regras de cadastro", keywords: ["empresa", "cnpj", "tenant", "configuração", "crm", "cadastro"] },
      { id: "usuarios", title: "Usuários & Permissões", icon: Shield, description: "Gerenciar acessos e roles", keywords: ["usuário", "permissão", "role", "acesso"] },
      { id: "auditoria", title: "Auditoria (Logs)", icon: FileSearch, description: "Histórico de alterações", keywords: ["log", "auditoria", "histórico", "alteração"] },
      { id: "notificacoes-config", title: "Notificações", icon: Bell, description: "Configurar tipos de notificação da empresa", keywords: ["notificação", "push", "alerta", "configurar", "ativar"], separator: true },
      { id: "links-instalacao", title: "Links & Captação", icon: Smartphone, description: "Links de captação, QR Codes e App PWA", keywords: ["PWA", "link", "instalação", "app", "canal", "captação", "qr", "whatsapp"] },
      { id: "changelog", title: "Atualizações", icon: HistoryIcon, description: "Histórico de atualizações do sistema", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"] },
      { id: "data-reset", title: "Limpeza de Dados", icon: Trash2, description: "Reset seletivo por segmento", keywords: ["reset", "limpeza", "deletar", "remover"] },
    ],
  },
];
