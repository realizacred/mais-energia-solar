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
  { nav_key: "dashboard", label_default: "Painel Geral", group_default: "Painel", order_default: 0, icon: "BarChart3", description: "Resumo de métricas e indicadores do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores", "dashboard"], criticality: "business_critical", permission: "all" },
  { nav_key: "performance", label_default: "Performance", group_default: "Painel", order_default: 1, icon: "TrendingUp", description: "Ranking de consultores, motivos de perda e métricas de funil", keywords: ["performance", "ranking", "conversão", "perda", "vendas", "relatório"], criticality: "normal", permission: "admin_only" },

  // ── Comercial ──
  { nav_key: "leads", label_default: "Leads", group_default: "Comercial", order_default: 0, icon: "Users", description: "Cadastro e acompanhamento de oportunidades", keywords: ["contato", "prospect", "captura", "formulário", "lead"], criticality: "business_critical", permission: "all" },
  // propostas-nativas removido do menu — propostas são geradas apenas dentro de projetos
  { nav_key: "pipeline", label_default: "Funil Comercial", group_default: "Comercial", order_default: 1, icon: "Kanban", description: "Visualize e gerencie as etapas de venda", keywords: ["kanban", "etapas", "funil", "conversão", "pipeline"], criticality: "normal", permission: "all" },
  { nav_key: "projetos", label_default: "Projetos", group_default: "Comercial", order_default: 2, icon: "FolderKanban", description: "Gerencie projetos por etapa e responsável", keywords: ["projeto", "pipeline", "funil", "kanban", "etapa", "proposta", "gerador"], criticality: "business_critical", permission: "all" },
  { nav_key: "followup", label_default: "Acompanhamentos", group_default: "Comercial", order_default: 4, icon: "Bell", description: "Retornos e lembretes de leads ativos", keywords: ["lembrete", "retorno", "agendamento", "tarefa", "follow-up"], criticality: "normal", permission: "all" },
  { nav_key: "distribuicao", label_default: "Distribuição de Leads", group_default: "Comercial", order_default: 9, icon: "RotateCcw", description: "Regras automáticas de atribuição", keywords: ["fila", "round-robin", "atribuição", "regras"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "sla-breaches", label_default: "Alertas de Prazo", group_default: "Comercial", order_default: 10, icon: "AlertTriangle", description: "Leads com tempo de resposta excedido", keywords: ["prazo", "atraso", "violação", "alerta", "SLA"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inteligencia", label_default: "Inteligência Comercial", group_default: "Comercial", order_default: 11, icon: "Brain", description: "Scoring de leads e previsão de receita", keywords: ["score", "previsão", "IA", "análise", "ranking"], criticality: "normal", permission: "all", separator: true },

  // ── Atendimento ──
  { nav_key: "inbox", label_default: "Atendimento", group_default: "Atendimento", order_default: 0, icon: "MessageCircle", description: "Central de conversas e mensagens", keywords: ["chat", "mensagem", "conversa", "WhatsApp", "inbox"], criticality: "business_critical", permission: "all" },
  { nav_key: "followup-queue", label_default: "Fila de Retorno", group_default: "Atendimento", order_default: 1, icon: "CalendarClock", description: "Clientes aguardando retorno", keywords: ["pendente", "fila", "aguardando", "retorno"], criticality: "normal", permission: "all" },
  { nav_key: "followup-wa", label_default: "Regras de Retorno", group_default: "Atendimento", order_default: 2, icon: "Bell", description: "Automação de acompanhamento via WhatsApp", keywords: ["automação", "regra", "configurar", "agendamento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-etiquetas", label_default: "Etiquetas", group_default: "Atendimento", order_default: 3, icon: "Tag", description: "Tags para organizar conversas WhatsApp", keywords: ["tag", "etiqueta", "classificação", "organizar", "whatsapp"], criticality: "normal", permission: "admin_only" },
  { nav_key: "respostas-rapidas", label_default: "Respostas Rápidas", group_default: "Atendimento", order_default: 4, icon: "Sparkles", description: "Templates de mensagens pré-definidas", keywords: ["template", "atalho", "mensagem", "rápida"], criticality: "normal", permission: "admin_only" },
  { nav_key: "metricas-atendimento", label_default: "Métricas de Atendimento", group_default: "Atendimento", order_default: 5, icon: "BarChart3", description: "Performance de atendimento por consultor e time", keywords: ["métricas", "performance", "tempo", "resposta", "SLA", "consultor"], criticality: "normal", permission: "admin_only" },
  // SolarZap removed — consolidated into Atendimento (inbox)

  // ── Clientes ──
  { nav_key: "clientes", label_default: "Clientes", group_default: "Clientes", order_default: 0, icon: "UserCheck", description: "Cadastro, documentos e histórico de clientes", keywords: ["cliente", "contrato", "documentação", "CPF"], criticality: "normal", permission: "all" },
  { nav_key: "checklists", label_default: "Documentação", group_default: "Clientes", order_default: 1, icon: "ClipboardList", description: "Checklists e documentos de projeto", keywords: ["checklist", "documento", "verificação", "projeto"], criticality: "normal", permission: "all" },
  { nav_key: "avaliacoes", label_default: "Satisfação (NPS)", group_default: "Clientes", order_default: 2, icon: "Star", description: "Pesquisas de satisfação e avaliações", keywords: ["NPS", "CSAT", "feedback", "satisfação", "nota", "indicação"], criticality: "normal", permission: "all" },
  { nav_key: "servicos", label_default: "Agenda de Serviços", group_default: "Clientes", order_default: 3, icon: "CalendarClock", description: "Visitas técnicas e agendamentos", keywords: ["agenda", "visita", "instalação", "técnico"], criticality: "normal", permission: "all" },
  { nav_key: "documentos", label_default: "Documentos & Assinatura", group_default: "Clientes", order_default: 4, icon: "FileSignature", description: "Templates de documentos e assinatura eletrônica", keywords: ["documento", "contrato", "assinatura", "template", "docx", "pdf", "procuração"], criticality: "normal", permission: "admin_only" },

  // ── Operações ──
  { nav_key: "instaladores", label_default: "Equipe Técnica", group_default: "Operações", order_default: 0, icon: "Wrench", description: "Cadastro e gestão de instaladores", keywords: ["técnico", "instalador", "equipe", "campo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "validacao", label_default: "Aprovação de Vendas", group_default: "Operações", order_default: 1, icon: "ClipboardCheck", description: "Validar e aprovar vendas realizadas", keywords: ["aprovação", "validar", "conferência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "tarefas", label_default: "Tarefas & Prazos", group_default: "Operações", order_default: 2, icon: "ClipboardList", description: "Controle de pendências e prazos", keywords: ["tarefa", "prazo", "SLA", "pendência"], criticality: "normal", permission: "all" },

  // ── Financeiro ──
  { nav_key: "recebimentos", label_default: "Contas a Receber", group_default: "Financeiro", order_default: 0, icon: "DollarSign", description: "Controle de parcelas e pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inadimplencia", label_default: "Inadimplência", group_default: "Financeiro", order_default: 1, icon: "AlertTriangle", description: "Parcelas vencidas e cobranças", keywords: ["atraso", "devedor", "cobrança", "inadimplente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "comissoes", label_default: "Comissões", group_default: "Financeiro", order_default: 2, icon: "Wallet", description: "Cálculo e controle de comissões", keywords: ["comissão", "consultor", "bonificação", "percentual"], criticality: "normal", permission: "admin_only" },
  { nav_key: "fiscal", label_default: "Fiscal", group_default: "Financeiro", order_default: 3, icon: "ReceiptText", description: "Emissão de notas de serviço e importação de XMLs", keywords: ["nota", "fiscal", "NF", "NFS-e", "XML", "emissão", "serviço"], criticality: "normal", permission: "admin_only" },
  // engenharia (Análise Tributária) foi movida para Premissas > aba Tributação
  { nav_key: "financiamento", label_default: "Financiamentos", group_default: "Financeiro", order_default: 5, icon: "Building2", description: "Bancos, taxas e simulações de crédito", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"], criticality: "normal", permission: "admin_only" },

  // ── Equipe ──
  { nav_key: "vendedores", label_default: "Consultores", group_default: "Equipe", order_default: 0, icon: "Users", description: "Cadastro e gestão de consultores", keywords: ["consultor", "consultora", "consultores", "equipe", "cadastro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "aprovacao", label_default: "Solicitações de Acesso", group_default: "Equipe", order_default: 1, icon: "ClipboardCheck", description: "Aprovar novos usuários e acessos", keywords: ["aprovação", "solicitação", "pendente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "gamificacao", label_default: "Metas & Ranking", group_default: "Equipe", order_default: 2, icon: "Trophy", description: "Metas, pontuação e ranking da equipe", keywords: ["meta", "ranking", "conquista", "pontuação", "competição", "gamificação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "release", label_default: "Checklist de Versão", group_default: "Equipe", order_default: 3, icon: "Rocket", description: "Controle de entregas e lançamentos", keywords: ["versão", "release", "novidade"], criticality: "normal", permission: "admin_only" },

  // ── IA ──
  { nav_key: "diretor", label_default: "Assistente IA", group_default: "IA", order_default: 0, icon: "Sparkles", description: "Análises inteligentes e sugestões automáticas", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência", "assistente"], criticality: "normal", permission: "all" },

  // ── Cadastros ──
  { nav_key: "equipamentos", label_default: "Equipamentos", group_default: "Cadastros", order_default: 0, icon: "Package", description: "Kits e componentes de sistemas solares", keywords: ["equipamento", "kit", "produto", "componente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "modulos", label_default: "Módulos Solares", group_default: "Cadastros", order_default: 1, icon: "Sun", description: "Catálogo de painéis e módulos fotovoltaicos", keywords: ["módulo", "painel", "placa", "solar", "fotovoltaico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inversores-cadastro", label_default: "Inversores", group_default: "Cadastros", order_default: 2, icon: "Cpu", description: "Catálogo de inversores solares", keywords: ["inversor", "string", "microinversor", "potência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "baterias", label_default: "Baterias", group_default: "Cadastros", order_default: 3, icon: "Battery", description: "Catálogo de baterias e armazenamento", keywords: ["bateria", "armazenamento", "storage", "energia"], criticality: "normal", permission: "admin_only" },
  { nav_key: "concessionarias", label_default: "Concessionárias", group_default: "Cadastros", order_default: 4, icon: "Building", description: "Distribuidoras de energia e tarifas", keywords: ["concessionária", "distribuidora", "tarifa", "energia", "ICMS"], criticality: "normal", permission: "admin_only" },
  { nav_key: "premissas", label_default: "Premissas", group_default: "Cadastros", order_default: 5, icon: "Sliders", description: "Parâmetros financeiros, técnicos e valores padrões para dimensionamento", keywords: ["premissas", "financeiras", "telhado", "irradiância", "tarifa", "padrão", "defaults"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "config", label_default: "Calculadora Solar", group_default: "Cadastros", order_default: 6, icon: "Calculator", description: "Parâmetros de cálculo de geração e payback", keywords: ["calculadora", "cálculo", "geração", "payback", "simulação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meteorologia", label_default: "Base meteorológica", group_default: "Cadastros", order_default: 7, icon: "Database", description: "Dados de irradiância solar, importação CSV/API, auditoria de integridade e teste de lookup", keywords: ["irradiância", "solar", "dataset", "INPE", "NASA", "importação", "GHI", "DHI", "DNI", "CSV", "meteorológica", "atlas", "limpar", "provider", "versionamento", "API", "sincronizar"], criticality: "normal", permission: "admin_only" },
  
  { nav_key: "pricing-policy", label_default: "Política de Preços", group_default: "Financeiro", order_default: 6, icon: "Shield", description: "Regras versionadas de precificação, margens e comissões", keywords: ["precificação", "margem", "comissão", "custo", "política", "pricing"], criticality: "business_critical", permission: "admin_only" },

  // ── Site ──
  { nav_key: "site-config", label_default: "Configuração do Site", group_default: "Site", order_default: 0, icon: "Globe", description: "Aparência, branding e identidade visual", keywords: ["site", "branding", "cores", "logo", "identidade", "visual"], criticality: "normal", permission: "admin_only" },
  { nav_key: "site-servicos", label_default: "Serviços do Site", group_default: "Site", order_default: 1, icon: "Briefcase", description: "Serviços exibidos na página institucional", keywords: ["serviço", "oferta", "página", "institucional"], criticality: "normal", permission: "admin_only" },
  { nav_key: "obras", label_default: "Portfólio de Obras", group_default: "Site", order_default: 2, icon: "Image", description: "Galeria de projetos instalados", keywords: ["obra", "portfólio", "galeria", "projeto", "foto", "instalação"], criticality: "normal", permission: "admin_only" },

  // ── Integrações ──
  { nav_key: "saude-integracoes", label_default: "Saúde das integrações", group_default: "Integrações", order_default: 0, icon: "Activity", description: "Status em tempo real de todas as conexões externas", keywords: ["saúde", "health", "status", "integração", "monitoramento", "conexão"], criticality: "normal", permission: "admin_only" },
  { nav_key: "integracoes", label_default: "Google Agenda", group_default: "Integrações", order_default: 1, icon: "Calendar", description: "Configurar, auditar e gerenciar integração com Google Agenda", keywords: ["integração", "google", "calendar", "agenda", "oauth", "auditoria"], criticality: "normal", permission: "admin_only" },
  { nav_key: "openai-config", label_default: "OpenAI", group_default: "Integrações", order_default: 2, icon: "Bot", description: "Configurar chave de API do OpenAI", keywords: ["openai", "gpt", "api", "key", "ia"], criticality: "normal", permission: "admin_only" },
  { nav_key: "gemini-config", label_default: "Google Gemini", group_default: "Integrações", order_default: 3, icon: "Sparkles", description: "Configurar chave de API do Google Gemini", keywords: ["gemini", "google", "ai", "api", "key"], criticality: "normal", permission: "admin_only" },
  { nav_key: "solarmarket-config", label_default: "SolarMarket", group_default: "Integrações", order_default: 4, icon: "Sun", description: "Configurar chave de API do SolarMarket", keywords: ["solarmarket", "cotação", "equipamento", "preço"], criticality: "normal", permission: "admin_only" },
  { nav_key: "google-maps-config", label_default: "Google Maps", group_default: "Integrações", order_default: 5, icon: "MapPin", description: "Configurar chave de API do Google Maps para mapas e geocodificação", keywords: ["google", "maps", "mapa", "geocodificação", "api", "key"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-instances", label_default: "Instâncias WhatsApp", group_default: "Integrações", order_default: 5, icon: "Smartphone", description: "Gerenciar números e conexões WhatsApp", keywords: ["instância", "evolution", "API", "número"], criticality: "normal", permission: "admin_only" },
  { nav_key: "whatsapp", label_default: "WhatsApp API", group_default: "Integrações", order_default: 6, icon: "MessageCircle", description: "Automações e configurações de mensagens", keywords: ["API", "automação", "webhook", "bot"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meta-facebook-config", label_default: "Meta Facebook Ads", group_default: "Integrações", order_default: 7, icon: "Facebook", description: "Credenciais e configurações do Meta para captura de leads e métricas", keywords: ["meta", "facebook", "ads", "lead", "marketing", "pixel", "webhook"], criticality: "normal", permission: "admin_only" },
  { nav_key: "instagram", label_default: "Instagram", group_default: "Integrações", order_default: 8, icon: "Instagram", description: "Sincronizar conteúdo do Instagram", keywords: ["instagram", "post", "rede social", "feed"], criticality: "normal", permission: "admin_only" },
  { nav_key: "webhooks", label_default: "Webhooks", group_default: "Integrações", order_default: 9, icon: "Webhook", description: "Conexões com sistemas externos", keywords: ["webhook", "integração", "API", "n8n"], criticality: "normal", permission: "admin_only" },
  { nav_key: "n8n", label_default: "Automações", group_default: "Integrações", order_default: 10, icon: "Workflow", description: "Workflows e processos automatizados", keywords: ["n8n", "automação", "workflow", "MCP"], criticality: "normal", permission: "admin_only" },
  { nav_key: "payment-gateway", label_default: "Pagamentos (Asaas)", group_default: "Integrações", order_default: 10, icon: "CreditCard", description: "Configurar gateway de pagamento para boletos e Pix", keywords: ["asaas", "boleto", "pix", "pagamento", "gateway", "cobrança"], criticality: "normal", permission: "admin_only" },
  

  // ── Projetos & Propostas (configurações operacionais) ──
  { nav_key: "proposta-comercial", label_default: "Proposta Comercial", group_default: "Projetos & Propostas", order_default: 0, icon: "FileText", description: "Variáveis, modelos de proposta, e-mail e configurações", keywords: ["proposta", "comercial", "variável", "template", "modelo", "email", "catálogo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "custom-fields", label_default: "Opções Customizáveis", group_default: "Projetos & Propostas", order_default: 1, icon: "Settings2", description: "Campos customizados, premissas, tipos de atividade e motivos de perda", keywords: ["campo", "customizado", "atividade", "motivo", "perda", "funil", "personalizar", "custom", "premissa"], criticality: "normal", permission: "admin_only" },
  { nav_key: "ai-config", label_default: "Configuração de IA", group_default: "Projetos & Propostas", order_default: 2, icon: "Brain", description: "Modelo, temperatura e regras de IA", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência", "artificial", "configuração"], criticality: "normal", permission: "admin_only" },

  // ── Configurações (administração do sistema) ──
  { nav_key: "tenant-settings", label_default: "Dados da Empresa", group_default: "Configurações", order_default: 0, icon: "Building2", description: "Identidade, localização, branding IA e regras gerais", keywords: ["empresa", "cnpj", "tenant", "configuração", "crm", "cadastro", "branding", "ia", "solzinho"], criticality: "normal", permission: "admin_only" },
  { nav_key: "usuarios", label_default: "Usuários & Permissões", group_default: "Configurações", order_default: 1, icon: "Shield", description: "Controle de acessos e papéis", keywords: ["usuário", "permissão", "role", "acesso"], criticality: "system_critical", permission: "admin_only" },
  { nav_key: "permissoes", label_default: "Permissões por Papel", group_default: "Configurações", order_default: 1.5, icon: "Shield", description: "Configurar acesso de cada papel aos módulos", keywords: ["permissão", "role", "papel", "acesso", "módulo"], criticality: "system_critical", permission: "admin_only" },
  { nav_key: "auditoria", label_default: "Registro de Atividades", group_default: "Configurações", order_default: 2, icon: "FileSearch", description: "Histórico completo de alterações no sistema", keywords: ["log", "auditoria", "histórico", "alteração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "notificacoes-config", label_default: "Notificações", group_default: "Configurações", order_default: 3, icon: "Bell", description: "Configurar alertas e notificações da empresa", keywords: ["notificação", "push", "alerta", "configurar", "ativar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "links-instalacao", label_default: "Captação & App", group_default: "Configurações", order_default: 4, icon: "Smartphone", description: "Links de captação, QR Codes e instalação PWA", keywords: ["PWA", "link", "instalação", "app", "canal", "captação", "qr", "code", "whatsapp"], criticality: "normal", permission: "admin_only" },
  { nav_key: "menus", label_default: "Personalizar Menus", group_default: "Configurações", order_default: 5, icon: "LayoutList", description: "Reorganizar e ocultar itens do menu lateral", keywords: ["menu", "sidebar", "organizar", "ocultar", "personalizar", "navegação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "changelog", label_default: "Atualizações do Sistema", group_default: "Configurações", order_default: 6, icon: "History", description: "Novidades e melhorias recentes", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "data-reset", label_default: "Manutenção de Dados", group_default: "Configurações", order_default: 7, icon: "Trash2", description: "Limpeza seletiva e reset de dados", keywords: ["reset", "limpeza", "deletar", "remover", "manutenção"], criticality: "normal", permission: "admin_only" },
];

// ─── SECTION DEFAULTS ────────────────────────────────────────
// Metadata for sections (icon, colors, order) — used to reconstruct SidebarSection[]

export interface NavSectionMeta {
  label: string;
  icon: string;
  order: number;
  indicatorBg: string;
  indicatorClass?: string;
  iconColor?: string;
  activeClass: string;
  hoverClass: string;
  labelClass: string;
  defaultOpen: boolean;
}

export const NAV_SECTION_DEFAULTS: NavSectionMeta[] = [
  { label: "Painel", icon: "BarChart3", order: 0, indicatorBg: "bg-sidebar-intelligence", activeClass: "bg-sidebar-intelligence/12 text-sidebar-intelligence font-semibold border-l-2 border-sidebar-intelligence", hoverClass: "hover:bg-sidebar-intelligence/6", labelClass: "text-sidebar-intelligence", defaultOpen: true },
  { label: "Comercial", icon: "TrendingUp", order: 1, indicatorBg: "bg-sidebar-commercial", activeClass: "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial", hoverClass: "hover:bg-sidebar-commercial/6", labelClass: "text-sidebar-commercial", defaultOpen: true },
  { label: "Atendimento", icon: "MessageCircle", order: 2, indicatorBg: "bg-sidebar-atendimento", activeClass: "bg-sidebar-atendimento/12 text-sidebar-atendimento font-semibold border-l-2 border-sidebar-atendimento", hoverClass: "hover:bg-sidebar-atendimento/6", labelClass: "text-sidebar-atendimento", defaultOpen: true },
  { label: "Clientes", icon: "UserCheck", order: 3, indicatorBg: "bg-sidebar-clients", activeClass: "bg-sidebar-clients/12 text-sidebar-clients font-semibold border-l-2 border-sidebar-clients", hoverClass: "hover:bg-sidebar-clients/6", labelClass: "text-sidebar-clients", defaultOpen: true },
  { label: "Operações", icon: "Wrench", order: 4, indicatorBg: "bg-sidebar-operations", activeClass: "bg-sidebar-operations/12 text-sidebar-operations font-semibold border-l-2 border-sidebar-operations", hoverClass: "hover:bg-sidebar-operations/6", labelClass: "text-sidebar-operations", defaultOpen: false },
  { label: "Financeiro", icon: "Wallet", order: 5, indicatorBg: "bg-sidebar-finance", activeClass: "bg-sidebar-finance/12 text-sidebar-finance font-semibold border-l-2 border-sidebar-finance", hoverClass: "hover:bg-sidebar-finance/6", labelClass: "text-sidebar-finance", defaultOpen: false },
  { label: "Equipe", icon: "Users", order: 6, indicatorBg: "bg-sidebar-cadastros", activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros", hoverClass: "hover:bg-sidebar-cadastros/6", labelClass: "text-sidebar-cadastros", defaultOpen: false },
  { label: "IA", icon: "Bot", order: 7, indicatorBg: "bg-sidebar-ai", activeClass: "bg-sidebar-ai/12 text-sidebar-ai font-semibold border-l-2 border-sidebar-ai", hoverClass: "hover:bg-sidebar-ai/6", labelClass: "text-sidebar-ai", defaultOpen: false },
  { label: "Cadastros", icon: "Database", order: 8, indicatorBg: "bg-sidebar-cadastros", activeClass: "bg-sidebar-cadastros/12 text-sidebar-cadastros font-semibold border-l-2 border-sidebar-cadastros", hoverClass: "hover:bg-sidebar-cadastros/6", labelClass: "text-sidebar-cadastros", defaultOpen: false },
  { label: "Site", icon: "Globe", order: 9, indicatorBg: "bg-sidebar-marketing", activeClass: "bg-sidebar-marketing/12 text-sidebar-marketing font-semibold border-l-2 border-sidebar-marketing", hoverClass: "hover:bg-sidebar-marketing/6", labelClass: "text-sidebar-marketing", defaultOpen: false },
  { label: "Integrações", icon: "Plug", order: 10, indicatorBg: "bg-sidebar-settings", activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings", hoverClass: "hover:bg-sidebar-settings/6", labelClass: "text-sidebar-settings", defaultOpen: false },
  { label: "Projetos & Propostas", icon: "FolderCog", order: 11, indicatorBg: "bg-sidebar-commercial", activeClass: "bg-sidebar-commercial/12 text-sidebar-commercial font-semibold border-l-2 border-sidebar-commercial", hoverClass: "hover:bg-sidebar-commercial/6", labelClass: "text-sidebar-commercial", defaultOpen: false },
  { label: "Configurações", icon: "Settings", order: 12, indicatorBg: "bg-sidebar-settings", activeClass: "bg-sidebar-settings/12 text-sidebar-settings font-semibold border-l-2 border-sidebar-settings", hoverClass: "hover:bg-sidebar-settings/6", labelClass: "text-sidebar-settings", defaultOpen: false },
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
