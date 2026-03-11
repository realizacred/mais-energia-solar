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
  Package,
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
  Truck,
  Database,
  Gauge,
  LayoutList,
  Sliders,
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
  /** CSS class for the indicator square (maps to sidebar-indicator-* classes) */
  indicatorClass: string;
  /** Tailwind text color class for item icons in this section */
  iconColor: string;
  /** Whether the section is expanded by default */
  defaultOpen?: boolean;
}

/**
 * Legacy sidebar config — fallback only.
 * The actual menu structure comes from src/config/navRegistry.ts via useNavConfig().
 *
 * Sections (15):
 *  1. Painel
 *  2. Comercial
 *  3. Atendimento
 *  4. Clientes
 *  5. Pós-Venda
 *  6. Operações
 *  7. Financeiro
 *  8. Equipe
 *  9. IA
 * 10. Energia
 * 11. Integrações
 * 12. Site
 * 13. Cadastros
 * 14. Configurações
 * 15. Administração
 */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  // ─── 1. PAINEL ─────────────────────────────────────────────
  {
    label: "Painel",
    labelIcon: BarChart3,
    indicatorBg: "bg-sidebar-intelligence",
    indicatorClass: "sidebar-indicator-intelligence",
    iconColor: "text-sidebar-intelligence",
    activeClass: "bg-sidebar-intelligence/12 text-sidebar-intelligence font-semibold border-l-2 border-sidebar-intelligence",
    hoverClass: "hover:bg-sidebar-intelligence/6",
    labelClass: "text-sidebar-intelligence",
    defaultOpen: true,
    items: [
      { id: "dashboard", title: "Painel Geral", icon: BarChart3, description: "Visão geral do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores"] },
      { id: "performance", title: "Performance", icon: TrendingUp, description: "Ranking e métricas de funil", keywords: ["performance", "ranking", "conversão", "perda"] },
    ],
  },

  // ─── 2. COMERCIAL ─────────────────────────────────────────
  {
    label: "Comercial",
    labelIcon: TrendingUp,
    indicatorBg: "bg-sidebar-commercial",
    indicatorClass: "sidebar-indicator-commercial",
    iconColor: "text-sidebar-commercial",
    activeClass: "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial",
    hoverClass: "hover:bg-sidebar-commercial/6",
    labelClass: "text-sidebar-commercial",
    defaultOpen: true,
    items: [
      { id: "leads", title: "Leads", icon: Users, description: "Cadastro e gestão de leads", keywords: ["contato", "prospect", "captura", "formulário"] },
      { id: "pipeline", title: "Pipeline", icon: Kanban, description: "Funil de vendas visual", keywords: ["kanban", "etapas", "funil", "conversão"] },
      { id: "projetos", title: "Projetos", icon: FolderKanban, description: "Pipeline de projetos", keywords: ["projeto", "pipeline", "funil", "kanban", "etapa", "proposta"] },
      { id: "followup", title: "Acompanhamentos", icon: Bell, description: "Retornos e lembretes", keywords: ["lembrete", "retorno", "agendamento", "tarefa"] },
      { id: "distribuicao", title: "Distribuição de Leads", icon: RotateCcw, description: "Regras automáticas", keywords: ["fila", "round-robin", "atribuição", "regras"], separator: true },
      { id: "sla-breaches", title: "SLA & Breaches", icon: AlertTriangle, description: "Violações de prazo", keywords: ["prazo", "atraso", "violação", "alerta"] },
      { id: "inteligencia", title: "Inteligência Comercial", icon: Brain, description: "Scoring & Previsão", keywords: ["score", "previsão", "IA", "análise", "ranking"], separator: true },
      { id: "aprovacao", title: "Aprovações", icon: ClipboardCheck, description: "Solicitações de acesso", keywords: ["aprovação", "solicitação", "pendente"] },
    ],
  },

  // ─── 3. ATENDIMENTO ────────────────────────────────────────
  {
    label: "Atendimento",
    labelIcon: MessageCircle,
    indicatorBg: "bg-sidebar-atendimento",
    indicatorClass: "sidebar-indicator-atendimento",
    iconColor: "text-sidebar-atendimento",
    activeClass: "bg-sidebar-atendimento/12 text-sidebar-atendimento font-semibold border-l-2 border-sidebar-atendimento",
    hoverClass: "hover:bg-sidebar-atendimento/6",
    labelClass: "text-sidebar-atendimento",
    defaultOpen: true,
    items: [
      { id: "inbox", title: "Central WhatsApp", icon: MessageCircle, description: "Inbox de atendimento", keywords: ["chat", "mensagem", "conversa", "WhatsApp"] },
      { id: "followup-queue", title: "Fila de Follow-ups", icon: CalendarClock, description: "Clientes aguardando retorno", keywords: ["pendente", "fila", "aguardando", "retorno"] },
      { id: "followup-wa", title: "Regras de Follow-up", icon: Bell, description: "Automação de acompanhamento WA", keywords: ["automação", "regra", "configurar", "agendamento"] },
      { id: "metricas-atendimento", title: "Métricas de Atendimento", icon: BarChart3, description: "Performance por consultor", keywords: ["métricas", "performance", "tempo", "resposta"] },
      { id: "regras-retorno", title: "Regras de Retorno", icon: RotateCcw, description: "Regras de retorno automático", keywords: ["retorno", "regra", "automático"] },
      { id: "followup-wa-queue", title: "Fila de Retorno", icon: CalendarClock, description: "Fila de retornos pendentes", keywords: ["retorno", "fila", "pendente"] },
      { id: "wa-etiquetas", title: "Etiquetas WhatsApp", icon: Tag, description: "Tags para conversas", keywords: ["tag", "etiqueta", "classificação", "organizar"] },
      { id: "respostas-rapidas", title: "Respostas Rápidas", icon: Sparkles, description: "Templates de mensagens", keywords: ["template", "atalho", "mensagem", "rápida"] },
    ],
  },

  // ─── 4. CLIENTES ───────────────────────────────────────────
  {
    label: "Clientes",
    labelIcon: UserCheck,
    indicatorBg: "bg-sidebar-clients",
    indicatorClass: "sidebar-indicator-clients",
    iconColor: "text-sidebar-clients",
    activeClass: "bg-sidebar-clients/12 text-sidebar-clients font-semibold border-l-2 border-sidebar-clients",
    hoverClass: "hover:bg-sidebar-clients/6",
    labelClass: "text-sidebar-clients",
    defaultOpen: true,
    items: [
      { id: "clientes", title: "Gestão de Clientes", icon: UserCheck, description: "Cadastro e documentos", keywords: ["cliente", "contrato", "documentação", "CPF"] },
      { id: "avaliacoes", title: "Avaliações NPS", icon: Star, description: "Pesquisas de satisfação", keywords: ["NPS", "CSAT", "feedback", "satisfação", "nota"] },
      { id: "documentos-assinaturas", title: "Documentos & Assinaturas", icon: FileText, description: "Templates e assinatura eletrônica", keywords: ["documento", "contrato", "assinatura", "template"] },
    ],
  },

  // ─── 5. PÓS-VENDA ─────────────────────────────────────────
  {
    label: "Pós-Venda",
    labelIcon: Wrench,
    indicatorBg: "bg-sidebar-operations",
    indicatorClass: "sidebar-indicator-operations",
    iconColor: "text-sidebar-operations",
    activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/6",
    labelClass: "text-sidebar-operations",
    defaultOpen: false,
    items: [
      { id: "pos-venda", title: "Dashboard", icon: BarChart3, description: "Visão geral do pós-venda", keywords: ["pós-venda", "preventiva", "dashboard"] },
      { id: "pos-venda-visitas", title: "Preventivas", icon: CalendarClock, description: "Visitas técnicas e preventivas", keywords: ["preventiva", "visita", "limpeza"] },
      { id: "pos-venda-planos", title: "Planos", icon: FileText, description: "Planos de manutenção", keywords: ["plano", "manutenção", "periodicidade"] },
      { id: "pos-venda-checklists", title: "Checklists", icon: ClipboardList, description: "Templates de checklist", keywords: ["checklist", "template", "inspeção"] },
      { id: "pos-venda-upsell", title: "Oportunidades", icon: TrendingUp, description: "Vendas adicionais e upgrades", keywords: ["upsell", "bateria", "expansão"] },
    ],
  },

  // ─── 6. OPERAÇÕES ──────────────────────────────────────────
  {
    label: "Operações",
    labelIcon: Wrench,
    indicatorBg: "bg-sidebar-operations",
    indicatorClass: "sidebar-indicator-operations",
    iconColor: "text-sidebar-operations",
    activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations",
    hoverClass: "hover:bg-sidebar-operations/6",
    labelClass: "text-sidebar-operations",
    defaultOpen: false,
    items: [
      { id: "instaladores", title: "Instaladores", icon: Wrench, description: "Equipe de campo", keywords: ["técnico", "instalador", "equipe", "campo"] },
      { id: "estoque", title: "Estoque", icon: Package, description: "Materiais e insumos", keywords: ["estoque", "material", "inventário"] },
      { id: "validacao", title: "Validação de Vendas", icon: ClipboardCheck, description: "Aprovar vendas realizadas", keywords: ["aprovação", "validar", "conferência"] },
      { id: "tarefas", title: "Tarefas & SLA", icon: ClipboardList, description: "Prazos e pendências", keywords: ["tarefa", "prazo", "SLA", "pendência"] },
      { id: "checklists", title: "Documentação", icon: ClipboardList, description: "Checklists de projeto", keywords: ["checklist", "documento", "verificação", "projeto"], separator: true },
      { id: "servicos", title: "Agenda de Serviços", icon: CalendarClock, description: "Visitas e agendamentos", keywords: ["agenda", "visita", "instalação", "técnico"] },
    ],
  },

  // ─── 7. FINANCEIRO ─────────────────────────────────────────
  {
    label: "Financeiro",
    labelIcon: Wallet,
    indicatorBg: "bg-sidebar-finance",
    indicatorClass: "sidebar-indicator-finance",
    iconColor: "text-sidebar-finance",
    activeClass: "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance",
    hoverClass: "hover:bg-sidebar-finance/6",
    labelClass: "text-sidebar-finance",
    defaultOpen: false,
    items: [
      { id: "recebimentos", title: "Recebimentos", icon: DollarSign, description: "Controle de pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"] },
      { id: "inadimplencia", title: "Inadimplência", icon: AlertTriangle, description: "Parcelas atrasadas", keywords: ["atraso", "devedor", "cobrança", "inadimplente"] },
      { id: "comissoes", title: "Comissões", icon: Wallet, description: "Comissões dos consultores", keywords: ["comissão", "consultor", "bonificação", "percentual"] },
      { id: "fiscal", title: "Fiscal", icon: FileText, description: "Notas fiscais e XML", keywords: ["nota", "fiscal", "NF", "NFS-e", "XML"] },
      { id: "financiamento", title: "Financiamentos", icon: Building2, description: "Bancos e taxas", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"], separator: true },
      { id: "engenharia", title: "Premissas Fiscais", icon: Calculator, description: "ICMS, fio B, payback", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo"] },
      { id: "politica-precos", title: "Política de Preços", icon: Shield, description: "Regras de precificação", keywords: ["precificação", "margem", "comissão", "custo", "política"] },
    ],
  },

  // ─── 8. EQUIPE ─────────────────────────────────────────────
  {
    label: "Equipe",
    labelIcon: Users,
    indicatorBg: "bg-sidebar-cadastros",
    indicatorClass: "sidebar-indicator-cadastros",
    iconColor: "text-sidebar-cadastros",
    activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros",
    hoverClass: "hover:bg-sidebar-cadastros/6",
    labelClass: "text-sidebar-cadastros",
    defaultOpen: false,
    items: [
      { id: "vendedores", title: "Consultores", icon: Users, description: "Cadastro de consultores", keywords: ["consultor", "consultora", "consultores", "equipe", "cadastro"] },
      { id: "gamificacao", title: "Gamificação", icon: Trophy, description: "Metas e ranking", keywords: ["meta", "ranking", "conquista", "pontuação", "competição"] },
    ],
  },

  // ─── 9. IA ─────────────────────────────────────────────────
  {
    label: "IA",
    labelIcon: Bot,
    indicatorBg: "bg-sidebar-ai",
    indicatorClass: "sidebar-indicator-ai",
    iconColor: "text-sidebar-ai",
    activeClass: "bg-sidebar-ai/12 text-sidebar-ai font-semibold border-l-2 border-sidebar-ai",
    hoverClass: "hover:bg-sidebar-ai/6",
    labelClass: "text-sidebar-ai",
    defaultOpen: false,
    items: [
      { id: "diretor", title: "Copilot IA", icon: Sparkles, description: "Análise inteligente & sugestões", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência"] },
      { id: "ai-config", title: "Configuração de IA", icon: Brain, description: "Modelo, temperatura e regras", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência"] },
    ],
  },

  // ─── 10. ENERGIA ───────────────────────────────────────────
  {
    label: "Energia",
    labelIcon: Zap,
    indicatorBg: "bg-sidebar-commercial",
    indicatorClass: "sidebar-indicator-commercial",
    iconColor: "text-sidebar-commercial",
    activeClass: "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial",
    hoverClass: "hover:bg-sidebar-commercial/6",
    labelClass: "text-sidebar-commercial",
    defaultOpen: false,
    items: [
      { id: "ucs", title: "Unidades Consumidoras", icon: Building2, description: "Gestão de UCs", keywords: ["UC", "unidade", "consumidora", "energia", "concessionária"] },
      { id: "monitoramento", title: "Monitoramento Solar", icon: BarChart3, description: "Dashboard de monitoramento", keywords: ["monitoramento", "solar", "dashboard", "energia"], separator: true },
      { id: "monitoramento/usinas", title: "Usinas", icon: Sun, description: "Mapa e lista de usinas", keywords: ["usina", "planta", "mapa", "lista"] },
      { id: "monitoramento/alertas", title: "Alertas", icon: AlertTriangle, description: "Central de alertas", keywords: ["alerta", "offline", "falha", "inversor"] },
      { id: "monitoramento/relatorios", title: "Relatórios", icon: FileText, description: "Relatórios de geração", keywords: ["relatório", "geração", "performance"] },
      { id: "solarmarket", title: "SolarMarket Importação", icon: Sun, description: "Importar clientes e projetos", keywords: ["solarmarket", "importar", "cliente"], separator: true },
      { id: "saude-tarifaria", title: "Saúde Tarifária", icon: Activity, description: "Alertas e governança", keywords: ["saúde", "alerta", "vigência", "governança"], separator: true },
      { id: "aneel-sync-status", title: "Status Sync ANEEL", icon: Zap, description: "Monitoramento do sync", keywords: ["sync", "aneel", "status", "log"] },
    ],
  },

  // ─── 11. INTEGRAÇÕES ────────────────────────────────────────
  {
    label: "Integrações",
    labelIcon: Cable,
    indicatorBg: "bg-sidebar-settings",
    indicatorClass: "sidebar-indicator-settings",
    iconColor: "text-sidebar-settings",
    activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings",
    hoverClass: "hover:bg-sidebar-settings/6",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      { id: "integracoes", title: "Catálogo de Integrações", icon: Cable, description: "Todas as integrações", keywords: ["integração", "catálogo", "provider", "conectar"] },
      { id: "saude-integracoes", title: "Saúde das Integrações", icon: Activity, description: "Status de conexões externas", keywords: ["saúde", "health", "status", "integração"] },
      { id: "meta-dashboard", title: "Meta Ads Dashboard", icon: BarChart3, description: "Métricas de campanhas Meta/Facebook", keywords: ["meta", "facebook", "ads", "campanha", "anúncio"] },
      { id: "webhooks", title: "Webhooks", icon: Webhook, description: "Integrações externas", keywords: ["webhook", "integração", "API", "n8n"], separator: true },
      { id: "wa-instances", title: "Instâncias WhatsApp", icon: Smartphone, description: "Evolution API", keywords: ["instância", "evolution", "API", "número"] },
      { id: "whatsapp", title: "Automação WhatsApp", icon: Bot, description: "Respostas automáticas e boas-vindas", keywords: ["API", "automação", "webhook", "bot"] },
    ],
  },

  // ─── 12. SITE ──────────────────────────────────────────────
  {
    label: "Site",
    labelIcon: Globe,
    indicatorBg: "bg-sidebar-marketing",
    indicatorClass: "sidebar-indicator-marketing",
    iconColor: "text-sidebar-marketing",
    activeClass: "bg-sidebar-marketing/12 text-sidebar-marketing font-semibold border-l-2 border-sidebar-marketing",
    hoverClass: "hover:bg-sidebar-marketing/6",
    labelClass: "text-sidebar-marketing",
    defaultOpen: false,
    items: [
      { id: "site-config", title: "Conteúdo & Visual", icon: Globe, description: "Layout e textos do site", keywords: ["site", "landing", "visual", "layout", "marca"] },
      { id: "site-servicos", title: "Serviços", icon: Wrench, description: "Serviços oferecidos", keywords: ["serviço", "oferta", "landing"] },
      { id: "obras", title: "Portfólio", icon: Sun, description: "Projetos realizados", keywords: ["portfólio", "obra", "projeto", "foto"] },
      { id: "instagram", title: "Instagram", icon: Instagram, description: "Sincronizar posts", keywords: ["instagram", "post", "rede social", "feed"] },
    ],
  },

  // ─── 13. CADASTROS ─────────────────────────────────────────
  {
    label: "Cadastros",
    labelIcon: Database,
    indicatorBg: "bg-sidebar-cadastros",
    indicatorClass: "sidebar-indicator-cadastros",
    iconColor: "text-sidebar-cadastros",
    activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros",
    hoverClass: "hover:bg-sidebar-cadastros/6",
    labelClass: "text-sidebar-cadastros",
    defaultOpen: false,
    items: [
      { id: "equipamentos", title: "Disjuntores & Transf.", icon: Plug, description: "Equipamentos elétricos", keywords: ["disjuntor", "transformador", "proteção", "elétrico"] },
      { id: "modulos", title: "Módulos Fotovoltaicos", icon: SunMedium, description: "Painéis solares", keywords: ["painel", "módulo", "solar", "fotovoltaico", "placa"] },
      { id: "inversores-cadastro", title: "Inversores", icon: Cpu, description: "Inversores solares", keywords: ["inversor", "potência", "micro-inversor", "string"] },
      { id: "baterias", title: "Baterias", icon: Battery, description: "Sistemas de armazenamento", keywords: ["bateria", "armazenamento", "lítio", "energia"] },
      { id: "fornecedores", title: "Fornecedores", icon: Truck, description: "Distribuidores e fabricantes", keywords: ["fornecedor", "distribuidor", "fabricante"] },
      { id: "concessionarias", title: "Concessionárias", icon: Lightbulb, description: "Tarifas por distribuidora", keywords: ["tarifa", "distribuidora", "concessionária", "ANEEL"], separator: true },
      { id: "dicionario-aneel", title: "Dicionário ANEEL", icon: FileSearch, description: "Mapeamento ANEEL ↔ Concessionárias", keywords: ["aneel", "dicionário", "match", "alias"] },
      { id: "tarifa-versoes", title: "Versões de Tarifa", icon: HistoryIcon, description: "Versionamento e rollback", keywords: ["versão", "tarifa", "rollback", "diff"] },
      { id: "premissas", title: "Premissas", icon: Sliders, description: "Parâmetros financeiros e técnicos", keywords: ["premissas", "financeiras", "telhado", "irradiância"], separator: true },
      { id: "meteorologia", title: "Base Meteorológica", icon: Database, description: "Dados de irradiância solar", keywords: ["irradiância", "solar", "INPE", "NASA", "GHI"] },
    ],
  },

  // ─── 14. CONFIGURAÇÕES ─────────────────────────────────────
  {
    label: "Configurações",
    labelIcon: Settings,
    indicatorBg: "bg-sidebar-settings",
    indicatorClass: "sidebar-indicator-settings",
    iconColor: "text-sidebar-settings",
    activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings",
    hoverClass: "hover:bg-sidebar-settings/6",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      { id: "config", title: "Calculadora Solar", icon: Calculator, description: "Parâmetros de geração e custo", keywords: ["cálculo", "geração", "kWp", "tarifa", "custo"] },
      { id: "lead-status", title: "Status de Leads", icon: Kanban, description: "Personalizar etapas do funil", keywords: ["etapa", "funil", "personalizar", "status"] },
      { id: "motivos-perda", title: "Motivos de Perda", icon: XCircle, description: "Razões de perda de negócios", keywords: ["perda", "motivo", "relatório", "análise"] },
      { id: "loading-config", title: "Loading & Mensagens", icon: Sun, description: "Animação e mensagens de carregamento", keywords: ["loading", "carregamento", "mensagem", "animação"] },
    ],
  },

  // ─── 15. ADMINISTRAÇÃO ─────────────────────────────────────
  {
    label: "Administração",
    labelIcon: Shield,
    indicatorBg: "bg-sidebar-settings",
    indicatorClass: "sidebar-indicator-settings",
    iconColor: "text-sidebar-settings",
    activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings",
    hoverClass: "hover:bg-sidebar-settings/6",
    labelClass: "text-sidebar-settings",
    defaultOpen: false,
    items: [
      { id: "tenant-settings", title: "Empresa", icon: Building2, description: "Identidade e localização", keywords: ["empresa", "cnpj", "tenant", "configuração"] },
      { id: "usuarios", title: "Usuários & Permissões", icon: Shield, description: "Gerenciar acessos e roles", keywords: ["usuário", "permissão", "role", "acesso"] },
      { id: "permissoes", title: "Permissões por Papel", icon: Shield, description: "Acesso de cada papel aos módulos", keywords: ["permissão", "role", "papel", "acesso", "módulo"] },
      { id: "auditoria", title: "Auditoria (Logs)", icon: FileSearch, description: "Histórico de alterações", keywords: ["log", "auditoria", "histórico", "alteração"] },
      { id: "notificacoes-config", title: "Notificações", icon: Bell, description: "Configurar notificações", keywords: ["notificação", "push", "alerta", "configurar"], separator: true },
      { id: "links-instalacao", title: "Links & Captação", icon: Smartphone, description: "Links de captação e QR Codes", keywords: ["PWA", "link", "instalação", "app", "captação", "qr"] },
      { id: "google-maps-config", title: "Google Maps", icon: MapPin, description: "API Key para mapas", keywords: ["google", "maps", "mapa", "api"] },
      { id: "release", title: "Release Notes", icon: Rocket, description: "Checklist de versões", keywords: ["versão", "release", "novidade"] },
      { id: "changelog", title: "Atualizações", icon: HistoryIcon, description: "Histórico de atualizações", keywords: ["changelog", "atualização", "novidade", "versão"] },
      { id: "menus", title: "Personalizar Menus", icon: LayoutList, description: "Reorganizar itens do menu", keywords: ["menu", "sidebar", "organizar", "personalizar"] },
      { id: "data-reset", title: "Limpeza de Dados", icon: Trash2, description: "Reset seletivo por segmento", keywords: ["reset", "limpeza", "deletar", "remover"] },
    ],
  },
];
