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
  FileText,
  Database,
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
  History as HistoryIcon,
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
 * Sidebar reorganizado em 7 seções lógicas:
 *
 * 1. Dashboard — Visão geral (sempre aberto)
 * 2. Operação — Uso diário: leads, propostas, clientes, inteligência
 * 3. Conversas — WhatsApp: inbox, follow-ups, templates
 * 4. Pós-Venda — Instalação, avaliações, agenda técnica
 * 5. Financeiro — Recebimentos, inadimplência, comissões
 * 6. Cadastros — Catálogo técnico, configurações de engenharia
 * 7. Administração — Usuários, integrações, site, auditoria, sistema
 */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  // ─── 1. DASHBOARD ─────────────────────────────────────────
  {
    label: "Dashboard",
    labelIcon: BarChart3,
    indicatorBg: "bg-sidebar-intelligence",
    activeClass:
      "bg-sidebar-intelligence/12 text-sidebar-intelligence font-semibold border-l-2 border-sidebar-intelligence",
    hoverClass: "hover:bg-sidebar-intelligence/6",
    labelClass: "text-sidebar-intelligence",
    defaultOpen: true,
    items: [
      { id: "dashboard", title: "Dashboard", icon: BarChart3, description: "Visão geral do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores"] },
    ],
  },

  // ─── 2. OPERAÇÃO — Uso diário da equipe comercial ─────────
  {
    label: "Operação",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-commercial",
    activeClass:
      "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial",
    hoverClass: "hover:bg-sidebar-commercial/6",
    labelClass: "text-sidebar-commercial",
    defaultOpen: true,
    items: [
      { id: "leads", title: "Leads", icon: Users, description: "Cadastro e gestão de leads", keywords: ["contato", "prospect", "captura", "formulário"] },
      { id: "pipeline", title: "Pipeline", icon: Kanban, description: "Funil de vendas visual", keywords: ["kanban", "etapas", "funil", "conversão"] },
      { id: "propostas", title: "Propostas", icon: FileText, description: "Propostas comerciais", keywords: ["orçamento", "cotação", "simulação", "preço"] },
      { id: "followup", title: "Follow-ups", icon: Bell, description: "Acompanhamento de leads", keywords: ["lembrete", "retorno", "agendamento", "tarefa"] },
      { id: "clientes", title: "Gestão de Clientes", icon: UserCheck, description: "Cadastro e documentos", keywords: ["cliente", "contrato", "documentação", "CPF"], separator: true },
      { id: "lead-status", title: "Status de Leads", icon: Kanban, description: "Personalizar etapas do funil", keywords: ["etapa", "funil", "personalizar", "status"], separator: true },
      { id: "motivos-perda", title: "Motivos de Perda", icon: XCircle, description: "Razões de perda de negócios", keywords: ["perda", "motivo", "relatório", "análise"] },
      { id: "distribuicao", title: "Distribuição", icon: RotateCcw, description: "Regras & fila de leads", keywords: ["fila", "round-robin", "atribuição", "regras"] },
      { id: "sla-breaches", title: "SLA & Breaches", icon: AlertTriangle, description: "Violações de prazo", keywords: ["prazo", "atraso", "violação", "alerta"] },
      { id: "inteligencia", title: "Inteligência Comercial", icon: Brain, description: "Scoring & Previsão", keywords: ["score", "previsão", "IA", "análise", "ranking"], separator: true },
      { id: "gamificacao", title: "Gamificação", icon: Trophy, description: "Metas e ranking", keywords: ["meta", "ranking", "conquista", "pontuação", "competição"] },
      { id: "diretor", title: "Copilot IA", icon: Sparkles, description: "Análise inteligente", keywords: ["IA", "copilot", "sugestão", "automático"] },
    ],
  },

  // ─── 3. CONVERSAS — WhatsApp ──────────────────────────────
  {
    label: "Conversas",
    labelIcon: MessageCircle,
    indicatorBg: "bg-sidebar-atendimento",
    activeClass:
      "bg-sidebar-atendimento/12 text-sidebar-atendimento font-semibold border-l-2 border-sidebar-atendimento",
    hoverClass: "hover:bg-sidebar-atendimento/6",
    labelClass: "text-sidebar-atendimento",
    defaultOpen: true,
    items: [
      { id: "inbox", title: "Central WhatsApp", icon: MessageCircle, description: "Inbox de atendimento", keywords: ["chat", "mensagem", "conversa", "WhatsApp"] },
      { id: "followup-queue", title: "Fila de Follow-ups", icon: CalendarClock, description: "Acompanhar follow-ups pendentes", keywords: ["pendente", "fila", "aguardando", "retorno"] },
      { id: "followup-wa", title: "Regras de Follow-up", icon: Bell, description: "Configurar regras de acompanhamento", keywords: ["automação", "regra", "configurar", "agendamento"] },
      { id: "wa-etiquetas", title: "Etiquetas WhatsApp", icon: Tag, description: "Tags para conversas", keywords: ["tag", "etiqueta", "classificação", "organizar"] },
      { id: "respostas-rapidas", title: "Respostas Rápidas", icon: Sparkles, description: "Templates de mensagens rápidas", keywords: ["template", "atalho", "mensagem", "rápida"], separator: true },
    ],
  },

  // ─── 4. PÓS-VENDA — Instalação, avaliações, agenda ───────
  {
    label: "Pós-Venda",
    labelIcon: Wrench,
    indicatorBg: "bg-sidebar-operations",
    activeClass:
      "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/6",
    labelClass: "text-sidebar-operations",
    defaultOpen: false,
    items: [
      { id: "checklists", title: "Documentação", icon: ClipboardList, description: "Checklists de projeto", keywords: ["checklist", "documento", "verificação", "projeto"] },
      { id: "avaliacoes", title: "Avaliações", icon: Star, description: "Feedback dos clientes", keywords: ["NPS", "feedback", "satisfação", "nota", "indicação"] },
      { id: "servicos", title: "Agenda Técnica", icon: CalendarClock, description: "Agendamentos de serviço", keywords: ["agenda", "visita", "instalação", "técnico"] },
      { id: "instaladores", title: "Instaladores", icon: Wrench, description: "Equipe de campo", keywords: ["técnico", "instalador", "equipe", "campo"], separator: true },
      { id: "validacao", title: "Validação", icon: ClipboardCheck, description: "Aprovar vendas realizadas", keywords: ["aprovação", "validar", "conferência"] },
      { id: "tarefas", title: "Tarefas & SLA", icon: ClipboardList, description: "Prazos e pendências", keywords: ["tarefa", "prazo", "SLA", "pendência"] },
    ],
  },

  // ─── 5. FINANCEIRO ────────────────────────────────────────
  {
    label: "Financeiro",
    labelIcon: Wallet,
    indicatorBg: "bg-sidebar-finance",
    activeClass:
      "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance",
    hoverClass: "hover:bg-sidebar-finance/6",
    labelClass: "text-sidebar-finance",
    defaultOpen: false,
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign, description: "Controle de pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"] },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle, description: "Parcelas atrasadas", keywords: ["atraso", "devedor", "cobrança", "inadimplente"] },
      { id: "comissoes", title: "Comissões", icon: Wallet, description: "Comissões dos vendedores", keywords: ["comissão", "vendedor", "bonificação", "percentual"] },
    ],
  },

  // ─── 6. CADASTROS — Catálogo técnico e configurações ──────
  {
    label: "Cadastros",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-cadastros",
    activeClass:
      "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros",
    hoverClass: "hover:bg-sidebar-cadastros/6",
    labelClass: "text-sidebar-cadastros",
    defaultOpen: false,
    items: [
      { id: "config", title: "Calculadora Solar", icon: Calculator, description: "Parâmetros de geração e custo", keywords: ["cálculo", "geração", "kWp", "tarifa", "custo"] },
      { id: "engenharia", title: "Engenharia Financeira", icon: Calculator, description: "Regras de cálculo: ICMS, fio B, payback", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo"] },
      { id: "financiamento", title: "Bancos", icon: Building2, description: "Taxas e financiamentos", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"] },
      { id: "equipamentos", title: "Disjuntores & Transf.", icon: Plug, description: "Cadastro de equipamentos elétricos", keywords: ["disjuntor", "transformador", "proteção", "elétrico"], separator: true },
      { id: "modulos", title: "Módulos Fotovoltaicos", icon: SunMedium, description: "Painéis solares disponíveis", keywords: ["painel", "módulo", "solar", "fotovoltaico", "placa"] },
      { id: "inversores-cadastro", title: "Inversores", icon: Cpu, description: "Inversores solares cadastrados", keywords: ["inversor", "potência", "micro-inversor", "string"] },
      { id: "baterias", title: "Baterias", icon: Battery, description: "Sistemas de armazenamento", keywords: ["bateria", "armazenamento", "lítio", "energia"] },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb, description: "Tarifas por distribuidora (impacta proposta)", keywords: ["tarifa", "distribuidora", "concessionária", "ANEEL"] },
    ],
  },

  // ─── 7. ADMINISTRAÇÃO — Usuários, integrações, sistema ────
  {
    label: "Administração",
    labelIcon: Shield,
    indicatorBg: "bg-sidebar-settings",
    activeClass:
      "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings",
    hoverClass: "hover:bg-sidebar-settings/6",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      // ── Equipe ──
      { id: "usuarios", title: "Usuários & Permissões", icon: Shield, description: "Gerenciar acessos e roles", keywords: ["usuário", "permissão", "role", "acesso"], subsectionLabel: "Equipe" },
      { id: "vendedores", title: "Consultores", icon: Users, description: "Cadastro de consultores", keywords: ["consultor", "vendedor", "equipe", "cadastro"] },
      { id: "aprovacao", title: "Aprovações", icon: ClipboardCheck, description: "Solicitações de acesso", keywords: ["aprovação", "solicitação", "pendente"] },
      // ── Integrações ──
      { id: "integracoes-status", title: "Status das Integrações", icon: Activity, description: "Health check de todas as APIs", keywords: ["status", "health", "integração", "API", "monitoramento"], subsectionLabel: "Integrações" },
      { id: "wa-instances", title: "Instâncias WhatsApp", icon: Smartphone, description: "Evolution API", keywords: ["instância", "evolution", "API", "número"], subsectionLabel: "Integrações" },
      { id: "whatsapp", title: "WhatsApp API", icon: MessageCircle, description: "Automações de mensagens", keywords: ["API", "automação", "webhook", "bot"] },
      { id: "instagram", title: "Instagram", icon: Instagram, description: "Sincronizar posts", keywords: ["instagram", "post", "rede social", "feed"] },
      { id: "solarmarket", title: "SolarMarket", icon: Sun, description: "Marketplace solar", keywords: ["marketplace", "solar", "integração"] },
      { id: "webhooks", title: "Webhooks", icon: Webhook, description: "Integrações externas", keywords: ["webhook", "integração", "API", "n8n"] },
      { id: "n8n", title: "Automações", icon: Workflow, description: "Workflows via MCP", keywords: ["n8n", "automação", "workflow", "MCP"] },
      { id: "google-calendar", title: "Google Calendar", icon: CalendarClock, description: "Sincronizar agenda", keywords: ["google", "calendar", "agenda", "calendário", "OAuth"] },
      // ── Site ──
      { id: "site-config", title: "Conteúdo & Visual", icon: Globe, description: "Layout e textos do site", keywords: ["site", "landing", "visual", "layout", "marca"], subsectionLabel: "Site" },
      { id: "site-servicos", title: "Serviços", icon: Wrench, description: "Serviços oferecidos", keywords: ["serviço", "oferta", "landing"] },
      { id: "obras", title: "Portfólio", icon: Sun, description: "Projetos realizados", keywords: ["portfólio", "obra", "projeto", "foto"] },
      // ── Sistema ──
      { id: "links-instalacao", title: "Links & Instalação", icon: Smartphone, description: "App PWA e links de vendedor", keywords: ["PWA", "link", "instalação", "app"], subsectionLabel: "Sistema" },
      { id: "auditoria", title: "Auditoria (Logs)", icon: FileSearch, description: "Histórico de alterações", keywords: ["log", "auditoria", "histórico", "alteração"] },
      { id: "release", title: "Release Notes", icon: Rocket, description: "Checklist de versões", keywords: ["versão", "release", "novidade"] },
      { id: "changelog", title: "Atualizações", icon: HistoryIcon, description: "Histórico de atualizações do sistema", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"] },
      { id: "data-reset", title: "Limpeza de Dados", icon: Trash2, description: "Reset seletivo por segmento", keywords: ["reset", "limpeza", "deletar", "remover"] },
    ],
  },
];
