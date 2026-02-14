/**
 * NAV REGISTRY — Source of truth imutável do produto.
 *
 * Cada item define:
 *  - nav_key: chave única (= item.id no sidebarConfig, = rota /admin/{nav_key})
 *  - label_default: nome padrão do item
 *  - group_default: seção padrão (label da seção)
 *  - order_default: posição dentro da seção
 *  - icon: ícone Lucide
 *  - description: texto auxiliar
 *  - keywords: busca semântica
 *  - criticality: "system_critical" | "business_critical" | "normal"
 *  - permission: "all" | "admin_only" (imutável, nunca muda via UI)
 *
 * REGRAS:
 *  - system_critical → NÃO pode ser ocultado NEM movido
 *  - business_critical → NÃO pode ser ocultado, pode ser reorganizado
 *  - normal → pode ser ocultado e reorganizado
 */

export type NavCriticality = "system_critical" | "business_critical" | "normal";
export type NavPermission = "all" | "admin_only";

export interface NavRegistryItem {
  nav_key: string;
  label_default: string;
  group_default: string;
  order_default: number;
  icon: string; // lucide icon name (resolved at render time)
  description: string;
  keywords: string[];
  criticality: NavCriticality;
  permission: NavPermission;
  /** Visual separator above this item */
  separator?: boolean;
  /** Sub-section label above this item */
  subsectionLabel?: string;
}

// ─── REGISTRY ────────────────────────────────────────────────

export const NAV_REGISTRY: NavRegistryItem[] = [
  // ── Dashboard ──
  { nav_key: "dashboard", label_default: "Dashboard", group_default: "Dashboard", order_default: 0, icon: "BarChart3", description: "Visão geral do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores"], criticality: "business_critical", permission: "all" },

  // ── Comercial ──
  { nav_key: "leads", label_default: "Leads", group_default: "Comercial", order_default: 0, icon: "Users", description: "Cadastro e gestão de leads", keywords: ["contato", "prospect", "captura", "formulário"], criticality: "business_critical", permission: "all" },
  { nav_key: "pipeline", label_default: "Pipeline", group_default: "Comercial", order_default: 1, icon: "Kanban", description: "Funil de vendas visual", keywords: ["kanban", "etapas", "funil", "conversão"], criticality: "normal", permission: "all" },
  { nav_key: "propostas", label_default: "Propostas (SM)", group_default: "Comercial", order_default: 2, icon: "FileText", description: "Importações SolarMarket", keywords: ["orçamento", "cotação", "solarmarket", "preço"], criticality: "normal", permission: "all" },
  { nav_key: "propostas-nativas", label_default: "Gerador de Propostas", group_default: "Comercial", order_default: 3, icon: "FileText", description: "Criar propostas nativas", keywords: ["proposta", "gerar", "wizard", "lei 14300", "nativa", "cotação"], criticality: "normal", permission: "all" },
  { nav_key: "followup", label_default: "Follow-ups", group_default: "Comercial", order_default: 4, icon: "Bell", description: "Acompanhamento de leads", keywords: ["lembrete", "retorno", "agendamento", "tarefa"], criticality: "normal", permission: "all" },
  { nav_key: "distribuicao", label_default: "Distribuição", group_default: "Comercial", order_default: 5, icon: "RotateCcw", description: "Regras & fila de leads", keywords: ["fila", "round-robin", "atribuição", "regras"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "sla-breaches", label_default: "SLA & Breaches", group_default: "Comercial", order_default: 6, icon: "AlertTriangle", description: "Violações de prazo", keywords: ["prazo", "atraso", "violação", "alerta"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inteligencia", label_default: "Inteligência Comercial", group_default: "Comercial", order_default: 7, icon: "Brain", description: "Scoring & Previsão", keywords: ["score", "previsão", "IA", "análise", "ranking"], criticality: "normal", permission: "all", separator: true },

  // ── Conversas ──
  { nav_key: "inbox", label_default: "Central WhatsApp", group_default: "Conversas", order_default: 0, icon: "MessageCircle", description: "Inbox de atendimento", keywords: ["chat", "mensagem", "conversa", "WhatsApp"], criticality: "business_critical", permission: "all" },
  { nav_key: "followup-queue", label_default: "Fila de Follow-ups", group_default: "Conversas", order_default: 1, icon: "CalendarClock", description: "Acompanhar follow-ups pendentes", keywords: ["pendente", "fila", "aguardando", "retorno"], criticality: "normal", permission: "all" },
  { nav_key: "followup-wa", label_default: "Follow-up WhatsApp", group_default: "Conversas", order_default: 2, icon: "Bell", description: "Regras de acompanhamento WA", keywords: ["automação", "regra", "configurar", "agendamento"], criticality: "normal", permission: "admin_only" },

  // ── Clientes ──
  { nav_key: "clientes", label_default: "Gestão de Clientes", group_default: "Clientes", order_default: 0, icon: "UserCheck", description: "Cadastro e documentos", keywords: ["cliente", "contrato", "documentação", "CPF"], criticality: "normal", permission: "all" },
  { nav_key: "checklists", label_default: "Documentação", group_default: "Clientes", order_default: 1, icon: "ClipboardList", description: "Checklists de projeto", keywords: ["checklist", "documento", "verificação", "projeto"], criticality: "normal", permission: "all" },
  { nav_key: "avaliacoes", label_default: "Avaliações", group_default: "Clientes", order_default: 2, icon: "Star", description: "NPS — satisfação do cliente (0–10)", keywords: ["NPS", "CSAT", "feedback", "satisfação", "nota", "indicação"], criticality: "normal", permission: "all" },
  { nav_key: "servicos", label_default: "Agenda Técnica", group_default: "Clientes", order_default: 3, icon: "CalendarClock", description: "Agendamentos de serviço", keywords: ["agenda", "visita", "instalação", "técnico"], criticality: "normal", permission: "all" },

  // ── Operações ──
  { nav_key: "instaladores", label_default: "Instaladores", group_default: "Operações", order_default: 0, icon: "Wrench", description: "Equipe de campo", keywords: ["técnico", "instalador", "equipe", "campo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "validacao", label_default: "Validação", group_default: "Operações", order_default: 1, icon: "ClipboardCheck", description: "Aprovar vendas realizadas", keywords: ["aprovação", "validar", "conferência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "tarefas", label_default: "Tarefas & SLA", group_default: "Operações", order_default: 2, icon: "ClipboardList", description: "Prazos e pendências", keywords: ["tarefa", "prazo", "SLA", "pendência"], criticality: "normal", permission: "all" },

  // ── Financeiro ──
  { nav_key: "recebimentos", label_default: "Recebimentos", group_default: "Financeiro", order_default: 0, icon: "DollarSign", description: "Controle de pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inadimplencia", label_default: "Inadimplência", group_default: "Financeiro", order_default: 1, icon: "AlertTriangle", description: "Parcelas atrasadas", keywords: ["atraso", "devedor", "cobrança", "inadimplente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "comissoes", label_default: "Comissões", group_default: "Financeiro", order_default: 2, icon: "Wallet", description: "Comissões dos consultores", keywords: ["comissão", "vendedor", "bonificação", "percentual"], criticality: "normal", permission: "admin_only" },
  { nav_key: "engenharia", label_default: "Engenharia Financeira", group_default: "Financeiro", order_default: 3, icon: "Calculator", description: "ICMS, fio B, payback", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "financiamento", label_default: "Bancos", group_default: "Financeiro", order_default: 4, icon: "Building2", description: "Taxas e financiamentos", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"], criticality: "normal", permission: "admin_only" },

  // ── Gestão ──
  { nav_key: "vendedores", label_default: "Consultores", group_default: "Gestão", order_default: 0, icon: "Users", description: "Cadastro de consultores", keywords: ["consultor", "vendedor", "equipe", "cadastro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "aprovacao", label_default: "Aprovações", group_default: "Gestão", order_default: 1, icon: "ClipboardCheck", description: "Solicitações de acesso", keywords: ["aprovação", "solicitação", "pendente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "gamificacao", label_default: "Gamificação", group_default: "Gestão", order_default: 2, icon: "Trophy", description: "Metas e ranking da equipe", keywords: ["meta", "ranking", "conquista", "pontuação", "competição"], criticality: "normal", permission: "admin_only" },
  { nav_key: "release", label_default: "Release Notes", group_default: "Gestão", order_default: 3, icon: "Rocket", description: "Checklist de versões", keywords: ["versão", "release", "novidade"], criticality: "normal", permission: "admin_only" },

  // ── IA ──
  { nav_key: "diretor", label_default: "Copilot IA", group_default: "IA", order_default: 0, icon: "Sparkles", description: "Análise inteligente & sugestões", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência"], criticality: "normal", permission: "all" },

  // ── Integrações ──
  { nav_key: "integracoes-status", label_default: "Status das Integrações", group_default: "Integrações", order_default: 0, icon: "Activity", description: "Health check de todas as APIs", keywords: ["status", "health", "integração", "API", "monitoramento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-instances", label_default: "Instâncias WhatsApp", group_default: "Integrações", order_default: 1, icon: "Smartphone", description: "Evolution API", keywords: ["instância", "evolution", "API", "número"], criticality: "normal", permission: "admin_only" },
  { nav_key: "whatsapp", label_default: "WhatsApp API", group_default: "Integrações", order_default: 2, icon: "MessageCircle", description: "Automações de mensagens", keywords: ["API", "automação", "webhook", "bot"], criticality: "normal", permission: "admin_only" },
  { nav_key: "instagram", label_default: "Instagram", group_default: "Integrações", order_default: 3, icon: "Instagram", description: "Sincronizar posts", keywords: ["instagram", "post", "rede social", "feed"], criticality: "normal", permission: "admin_only" },
  { nav_key: "solarmarket", label_default: "SolarMarket", group_default: "Integrações", order_default: 4, icon: "Sun", description: "Marketplace solar", keywords: ["marketplace", "solar", "integração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "webhooks", label_default: "Webhooks", group_default: "Integrações", order_default: 5, icon: "Webhook", description: "Integrações externas", keywords: ["webhook", "integração", "API", "n8n"], criticality: "normal", permission: "admin_only" },
  { nav_key: "n8n", label_default: "Automações", group_default: "Integrações", order_default: 6, icon: "Workflow", description: "Workflows via MCP", keywords: ["n8n", "automação", "workflow", "MCP"], criticality: "normal", permission: "admin_only" },
  // google-calendar route exists but menu item removed (unified into agenda-config)
  { nav_key: "ai-config", label_default: "Configuração de IA", group_default: "Integrações", order_default: 8, icon: "Brain", description: "Modelo, temperatura e gate de follow-up", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência", "artificial", "configuração"], criticality: "normal", permission: "admin_only" },

  // ── Site ──
  { nav_key: "site-config", label_default: "Conteúdo & Visual", group_default: "Site", order_default: 0, icon: "Globe", description: "Layout e textos do site", keywords: ["site", "landing", "visual", "layout", "marca"], criticality: "normal", permission: "admin_only" },
  { nav_key: "site-servicos", label_default: "Serviços", group_default: "Site", order_default: 1, icon: "Wrench", description: "Serviços oferecidos", keywords: ["serviço", "oferta", "landing"], criticality: "normal", permission: "admin_only" },
  { nav_key: "obras", label_default: "Portfólio", group_default: "Site", order_default: 2, icon: "Sun", description: "Projetos realizados", keywords: ["portfólio", "obra", "projeto", "foto"], criticality: "normal", permission: "admin_only" },

  // ── Configurações ──
  { nav_key: "config", label_default: "Calculadora Solar", group_default: "Configurações", order_default: 0, icon: "Calculator", description: "Parâmetros de geração e custo", keywords: ["cálculo", "geração", "kWp", "tarifa", "custo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "lead-status", label_default: "Status de Leads", group_default: "Configurações", order_default: 1, icon: "Kanban", description: "Personalizar etapas do funil", keywords: ["etapa", "funil", "personalizar", "status"], criticality: "normal", permission: "admin_only" },
  { nav_key: "motivos-perda", label_default: "Motivos de Perda", group_default: "Configurações", order_default: 2, icon: "XCircle", description: "Razões de perda de negócios", keywords: ["perda", "motivo", "relatório", "análise"], criticality: "normal", permission: "admin_only" },
  { nav_key: "respostas-rapidas", label_default: "Respostas Rápidas", group_default: "Configurações", order_default: 3, icon: "Sparkles", description: "Templates de mensagens", keywords: ["template", "atalho", "mensagem", "rápida"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-etiquetas", label_default: "Etiquetas WhatsApp", group_default: "Configurações", order_default: 4, icon: "Tag", description: "Tags para conversas", keywords: ["tag", "etiqueta", "classificação", "organizar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "equipamentos", label_default: "Disjuntores & Transf.", group_default: "Configurações", order_default: 5, icon: "Plug", description: "Equipamentos elétricos", keywords: ["disjuntor", "transformador", "proteção", "elétrico"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "modulos", label_default: "Módulos Fotovoltaicos", group_default: "Configurações", order_default: 6, icon: "SunMedium", description: "Painéis solares disponíveis", keywords: ["painel", "módulo", "solar", "fotovoltaico", "placa"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inversores-cadastro", label_default: "Inversores", group_default: "Configurações", order_default: 7, icon: "Cpu", description: "Inversores solares cadastrados", keywords: ["inversor", "potência", "micro-inversor", "string"], criticality: "normal", permission: "admin_only" },
  { nav_key: "baterias", label_default: "Baterias", group_default: "Configurações", order_default: 8, icon: "Battery", description: "Sistemas de armazenamento", keywords: ["bateria", "armazenamento", "lítio", "energia"], criticality: "normal", permission: "admin_only" },
  { nav_key: "concessionarias", label_default: "Concessionárias", group_default: "Configurações", order_default: 9, icon: "Lightbulb", description: "Tarifas por distribuidora", keywords: ["tarifa", "distribuidora", "concessionária", "ANEEL"], criticality: "normal", permission: "admin_only" },
  { nav_key: "menus", label_default: "Menus", group_default: "Configurações", order_default: 10, icon: "LayoutList", description: "Personalizar itens do menu lateral", keywords: ["menu", "navegação", "sidebar", "personalizar", "ordem"], criticality: "normal", permission: "admin_only" },
  { nav_key: "agenda-config", label_default: "Agenda & Compromissos", group_default: "Configurações", order_default: 11, icon: "Calendar", description: "Configurar agenda interna e Google Calendar", keywords: ["agenda", "compromisso", "google", "calendar", "agendamento"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "loading-config", label_default: "Loading & Mensagens", group_default: "Configurações", order_default: 12, icon: "Loader2", description: "Animação de loading e mensagens", keywords: ["loading", "mensagem", "animação", "sol", "overlay"], criticality: "normal", permission: "admin_only" },

  // ── Administração ──
  { nav_key: "tenant-settings", label_default: "Empresa", group_default: "Administração", order_default: -1, icon: "Building2", description: "Identidade, localização e regras de cadastro", keywords: ["empresa", "cnpj", "tenant", "configuração", "crm", "cadastro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "usuarios", label_default: "Usuários & Permissões", group_default: "Administração", order_default: 0, icon: "Shield", description: "Gerenciar acessos e roles", keywords: ["usuário", "permissão", "role", "acesso"], criticality: "system_critical", permission: "admin_only" },
  { nav_key: "auditoria", label_default: "Auditoria (Logs)", group_default: "Administração", order_default: 1, icon: "FileSearch", description: "Histórico de alterações", keywords: ["log", "auditoria", "histórico", "alteração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "notificacoes-config", label_default: "Notificações", group_default: "Administração", order_default: 2, icon: "Bell", description: "Configurar tipos de notificação da empresa", keywords: ["notificação", "push", "alerta", "configurar", "ativar"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "links-instalacao", label_default: "Links & Captação", group_default: "Administração", order_default: 3, icon: "Smartphone", description: "Links de captação, QR Codes e App PWA", keywords: ["PWA", "link", "instalação", "app", "canal", "captação", "qr", "code", "whatsapp"], criticality: "normal", permission: "admin_only" },
  { nav_key: "changelog", label_default: "Atualizações", group_default: "Administração", order_default: 4, icon: "History", description: "Histórico de atualizações do sistema", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "data-reset", label_default: "Limpeza de Dados", group_default: "Administração", order_default: 5, icon: "Trash2", description: "Reset seletivo por segmento", keywords: ["reset", "limpeza", "deletar", "remover"], criticality: "normal", permission: "admin_only" },
];

// ─── SECTION DEFAULTS ────────────────────────────────────────
// Metadata for sections (icon, colors, order) — used to reconstruct SidebarSection[]

export interface NavSectionMeta {
  label: string;
  icon: string;
  order: number;
  indicatorBg: string;
  activeClass: string;
  hoverClass: string;
  labelClass: string;
  defaultOpen: boolean;
}

export const NAV_SECTION_DEFAULTS: NavSectionMeta[] = [
  { label: "Dashboard", icon: "BarChart3", order: 0, indicatorBg: "bg-sidebar-intelligence", activeClass: "bg-sidebar-intelligence/12 text-sidebar-intelligence font-semibold border-l-2 border-sidebar-intelligence", hoverClass: "hover:bg-sidebar-intelligence/6", labelClass: "text-sidebar-intelligence", defaultOpen: true },
  { label: "Comercial", icon: "TrendingUp", order: 1, indicatorBg: "bg-sidebar-commercial", activeClass: "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial", hoverClass: "hover:bg-sidebar-commercial/6", labelClass: "text-sidebar-commercial", defaultOpen: true },
  { label: "Conversas", icon: "MessageCircle", order: 2, indicatorBg: "bg-sidebar-atendimento", activeClass: "bg-sidebar-atendimento/12 text-sidebar-atendimento font-semibold border-l-2 border-sidebar-atendimento", hoverClass: "hover:bg-sidebar-atendimento/6", labelClass: "text-sidebar-atendimento", defaultOpen: true },
  { label: "Clientes", icon: "UserCheck", order: 3, indicatorBg: "bg-sidebar-clients", activeClass: "bg-sidebar-clients/12 text-sidebar-clients font-semibold border-l-2 border-sidebar-clients", hoverClass: "hover:bg-sidebar-clients/6", labelClass: "text-sidebar-clients", defaultOpen: true },
  { label: "Operações", icon: "Wrench", order: 4, indicatorBg: "bg-sidebar-operations", activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations", hoverClass: "hover:bg-sidebar-operations/6", labelClass: "text-sidebar-operations", defaultOpen: false },
  { label: "Financeiro", icon: "Wallet", order: 5, indicatorBg: "bg-sidebar-finance", activeClass: "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance", hoverClass: "hover:bg-sidebar-finance/6", labelClass: "text-sidebar-finance", defaultOpen: false },
  { label: "Gestão", icon: "Users", order: 6, indicatorBg: "bg-sidebar-cadastros", activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros", hoverClass: "hover:bg-sidebar-cadastros/6", labelClass: "text-sidebar-cadastros", defaultOpen: false },
  { label: "IA", icon: "Bot", order: 7, indicatorBg: "bg-sidebar-ai", activeClass: "bg-sidebar-ai/12 text-sidebar-ai font-semibold border-l-2 border-sidebar-ai", hoverClass: "hover:bg-sidebar-ai/6", labelClass: "text-sidebar-ai", defaultOpen: false },
  { label: "Integrações", icon: "Cable", order: 8, indicatorBg: "bg-sidebar-integrations", activeClass: "bg-sidebar-integrations/12 text-sidebar-integrations font-semibold border-l-2 border-sidebar-integrations", hoverClass: "hover:bg-sidebar-integrations/6", labelClass: "text-sidebar-integrations", defaultOpen: false },
  { label: "Site", icon: "Globe", order: 9, indicatorBg: "bg-sidebar-marketing", activeClass: "bg-sidebar-marketing/12 text-sidebar-marketing font-semibold border-l-2 border-sidebar-marketing", hoverClass: "hover:bg-sidebar-marketing/6", labelClass: "text-sidebar-marketing", defaultOpen: false },
  { label: "Configurações", icon: "Settings", order: 10, indicatorBg: "bg-sidebar-cadastros", activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros", hoverClass: "hover:bg-sidebar-cadastros/6", labelClass: "text-sidebar-cadastros", defaultOpen: false },
  { label: "Administração", icon: "Shield", order: 11, indicatorBg: "bg-sidebar-settings", activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings", hoverClass: "hover:bg-sidebar-settings/6", labelClass: "text-sidebar-settings", defaultOpen: false },
];

// ─── HELPERS ─────────────────────────────────────────────────

/** Lookup by nav_key */
const REGISTRY_MAP = new Map(NAV_REGISTRY.map((r) => [r.nav_key, r]));

export function getRegistryItem(navKey: string): NavRegistryItem | undefined {
  return REGISTRY_MAP.get(navKey);
}

/** Get section metadata */
const SECTION_MAP = new Map(NAV_SECTION_DEFAULTS.map((s) => [s.label, s]));

export function getSectionMeta(label: string): NavSectionMeta | undefined {
  return SECTION_MAP.get(label);
}

/** All valid section labels */
export function getValidSectionLabels(): string[] {
  return NAV_SECTION_DEFAULTS.map((s) => s.label);
}
