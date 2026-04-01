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
 *
 * SEÇÕES (15):
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
  // ── 1. Painel ──
  { nav_key: "meu-painel", label_default: "Meu Painel", group_default: "Painel", order_default: -1, icon: "User", description: "Dashboard personalizado do consultor", keywords: ["meu", "painel", "consultor", "leads", "metas", "pessoal"], criticality: "business_critical", permission: "all" },
  { nav_key: "dashboard", label_default: "Painel Geral", group_default: "Painel", order_default: 0, icon: "BarChart3", description: "Resumo de métricas e indicadores do negócio", keywords: ["resumo", "métricas", "KPI", "overview", "indicadores", "dashboard"], criticality: "business_critical", permission: "all" },
  { nav_key: "performance", label_default: "Performance", group_default: "Painel", order_default: 1, icon: "TrendingUp", description: "Ranking de consultores, motivos de perda e métricas de funil", keywords: ["performance", "ranking", "conversão", "perda", "vendas", "relatório"], criticality: "normal", permission: "admin_only" },

  // ── 2. Comercial ──
  { nav_key: "leads", label_default: "Leads", group_default: "Comercial", order_default: 0, icon: "Users", description: "Cadastro e acompanhamento de oportunidades", keywords: ["contato", "prospect", "captura", "formulário", "lead"], criticality: "business_critical", permission: "all" },
  { nav_key: "pipeline", label_default: "Pipeline", group_default: "Comercial", order_default: 1, icon: "Kanban", description: "Visualize e gerencie as etapas de venda", keywords: ["kanban", "etapas", "funil", "conversão", "pipeline"], criticality: "normal", permission: "all" },
  { nav_key: "validacao", label_default: "Validação de Vendas", group_default: "Comercial", order_default: 2, icon: "ClipboardCheck", description: "Validar e aprovar vendas realizadas pelos consultores", keywords: ["aprovação", "validar", "conferência", "venda", "pendente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "projetos", label_default: "Projetos", group_default: "Comercial", order_default: 3, icon: "FolderKanban", description: "Gerencie projetos por etapa e responsável", keywords: ["projeto", "pipeline", "funil", "kanban", "etapa", "proposta", "gerador"], criticality: "business_critical", permission: "all" },
  { nav_key: "followup", label_default: "Acompanhamentos", group_default: "Comercial", order_default: 4, icon: "Bell", description: "Retornos e lembretes de leads ativos", keywords: ["lembrete", "retorno", "agendamento", "tarefa", "follow-up"], criticality: "normal", permission: "all" },
  { nav_key: "distribuicao", label_default: "Distribuição de Leads", group_default: "Comercial", order_default: 5, icon: "RotateCcw", description: "Regras automáticas de atribuição", keywords: ["fila", "round-robin", "atribuição", "regras"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "sla-breaches", label_default: "SLA & Breaches", group_default: "Comercial", order_default: 6, icon: "AlertTriangle", description: "Leads com tempo de resposta excedido", keywords: ["prazo", "atraso", "violação", "alerta", "SLA"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inteligencia", label_default: "Inteligência Comercial", group_default: "Comercial", order_default: 7, icon: "Brain", description: "Scoring de leads e previsão de receita", keywords: ["score", "previsão", "IA", "análise", "ranking"], criticality: "normal", permission: "all" },
  { nav_key: "inteligencia-alertas", label_default: "Alertas Inteligentes", group_default: "Comercial", order_default: 8, icon: "AlertTriangle", description: "Alertas de preço, urgência e concorrência", keywords: ["alerta", "inteligência", "dor", "objeção"], criticality: "normal", permission: "all" },
  { nav_key: "inteligencia-metricas", label_default: "Métricas de Inteligência", group_default: "Comercial", order_default: 9, icon: "BarChart3", description: "Conversão por temperamento e abordagem", keywords: ["métrica", "conversão", "temperamento", "dashboard"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inteligencia-config", label_default: "Config Inteligência", group_default: "Comercial", order_default: 10, icon: "Settings2", description: "Thresholds, detecção e direcionamento", keywords: ["configuração", "threshold", "ia", "modelo"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "aprovacao", label_default: "Aprovações", group_default: "Comercial", order_default: 8, icon: "ClipboardCheck", description: "Aprovar novos usuários e acessos", keywords: ["aprovação", "solicitação", "pendente"], criticality: "normal", permission: "admin_only" },

  // ── 3. Atendimento ──
  { nav_key: "inbox", label_default: "Central WhatsApp", group_default: "Atendimento", order_default: 0, icon: "MessageCircle", description: "Inbox de atendimento em tempo real", keywords: ["chat", "mensagem", "conversa", "WhatsApp", "inbox"], criticality: "business_critical", permission: "all" },
  { nav_key: "followup-queue", label_default: "Fila de Follow-ups", group_default: "Atendimento", order_default: 1, icon: "CalendarClock", description: "Clientes aguardando retorno automático", keywords: ["pendente", "fila", "aguardando", "retorno"], criticality: "normal", permission: "all" },
  { nav_key: "followup-wa", label_default: "Regras de Follow-up", group_default: "Atendimento", order_default: 2, icon: "Bell", description: "Automação de acompanhamento via WhatsApp", keywords: ["automação", "regra", "configurar", "agendamento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "metricas-atendimento", label_default: "Métricas de Atendimento", group_default: "Atendimento", order_default: 3, icon: "BarChart3", description: "Performance de atendimento por consultor", keywords: ["métricas", "performance", "tempo", "resposta", "SLA", "consultor"], criticality: "normal", permission: "admin_only" },
  { nav_key: "regras-retorno", label_default: "Regras de Retorno", group_default: "Atendimento", order_default: 4, icon: "RotateCcw", description: "Regras de retorno automático", keywords: ["retorno", "regra", "automático"], criticality: "normal", permission: "admin_only" },
  { nav_key: "followup-wa-queue", label_default: "Fila de Retorno", group_default: "Atendimento", order_default: 5, icon: "CalendarClock", description: "Fila de retornos pendentes", keywords: ["retorno", "fila", "pendente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-instances", label_default: "Instâncias WhatsApp", group_default: "_hidden", order_default: 30, icon: "Smartphone", description: "Conexões Evolution API (QR Code)", keywords: ["instância", "evolution", "API", "número", "QR"], criticality: "normal", permission: "admin_only" },
  { nav_key: "whatsapp", label_default: "Automação WhatsApp", group_default: "_hidden", order_default: 31, icon: "Bot", description: "Respostas automáticas, boas-vindas e horário comercial", keywords: ["API", "automação", "webhook", "bot", "auto-resposta"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-etiquetas", label_default: "Etiquetas WhatsApp", group_default: "Atendimento", order_default: 6, icon: "Tag", description: "Tags para organizar conversas", keywords: ["tag", "etiqueta", "classificação", "organizar", "whatsapp"], criticality: "normal", permission: "admin_only" },
  { nav_key: "respostas-rapidas", label_default: "Respostas Rápidas", group_default: "Atendimento", order_default: 7, icon: "Sparkles", description: "Templates de mensagens pré-definidas", keywords: ["template", "atalho", "mensagem", "rápida"], criticality: "normal", permission: "admin_only" },

  // ── 4. Clientes ──
  { nav_key: "clientes", label_default: "Gestão de Clientes", group_default: "Clientes", order_default: 0, icon: "UserCheck", description: "Cadastro, documentos e histórico de clientes", keywords: ["cliente", "contrato", "documentação", "CPF"], criticality: "normal", permission: "all" },
  { nav_key: "avaliacoes", label_default: "Avaliações NPS", group_default: "Clientes", order_default: 1, icon: "Star", description: "Pesquisas de satisfação e avaliações", keywords: ["NPS", "CSAT", "feedback", "satisfação", "nota", "indicação"], criticality: "normal", permission: "all" },
  { nav_key: "documentos-assinaturas", label_default: "Documentos & Assinaturas", group_default: "Clientes", order_default: 2, icon: "FileText", description: "Templates de documentos e assinatura eletrônica", keywords: ["documento", "contrato", "assinatura", "template", "docx", "pdf", "procuração"], criticality: "normal", permission: "admin_only" },

  // ── 5. Pós-Venda ──
  { nav_key: "pos-venda", label_default: "Dashboard", group_default: "Pós-Venda", order_default: 0, icon: "BarChart3", description: "Visão geral do pós-venda e preventivas", keywords: ["pós-venda", "preventiva", "dashboard", "garantia", "serviço"], criticality: "normal", permission: "all" },
  { nav_key: "pos-venda-visitas", label_default: "Preventivas", group_default: "Pós-Venda", order_default: 1, icon: "CalendarClock", description: "Visitas técnicas e preventivas", keywords: ["preventiva", "visita", "limpeza", "suporte", "vistoria"], criticality: "normal", permission: "all" },
  { nav_key: "pos-venda-planos", label_default: "Planos", group_default: "Pós-Venda", order_default: 2, icon: "FileText", description: "Planos de manutenção por projeto", keywords: ["plano", "manutenção", "periodicidade", "garantia"], criticality: "normal", permission: "all" },
  { nav_key: "pos-venda-checklists", label_default: "Checklists", group_default: "Pós-Venda", order_default: 3, icon: "ClipboardList", description: "Templates de checklist para visitas", keywords: ["checklist", "template", "inspeção", "verificação"], criticality: "normal", permission: "all" },
  { nav_key: "pos-venda-upsell", label_default: "Oportunidades", group_default: "Pós-Venda", order_default: 4, icon: "TrendingUp", description: "Vendas adicionais e upgrades", keywords: ["upsell", "bateria", "expansão", "carregador", "oportunidade"], criticality: "normal", permission: "all" },

  // ── 6. Operações ──
  { nav_key: "instaladores", label_default: "Instaladores", group_default: "Operações", order_default: 0, icon: "Wrench", description: "Cadastro e gestão de instaladores", keywords: ["técnico", "instalador", "equipe", "campo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "estoque", label_default: "Estoque", group_default: "Operações", order_default: 1, icon: "Package", description: "Materiais e insumos", keywords: ["estoque", "material", "inventário"], criticality: "normal", permission: "admin_only" },
  { nav_key: "tarefas", label_default: "Tarefas & SLA", group_default: "Operações", order_default: 3, icon: "ClipboardList", description: "Controle de pendências e prazos", keywords: ["tarefa", "prazo", "SLA", "pendência"], criticality: "normal", permission: "all" },
  { nav_key: "checklists", label_default: "Documentação", group_default: "Operações", order_default: 4, icon: "ClipboardList", description: "Checklists e documentos de projeto", keywords: ["checklist", "documento", "verificação", "projeto"], criticality: "normal", permission: "all", separator: true },
  { nav_key: "servicos", label_default: "Agenda de Serviços", group_default: "Operações", order_default: 5, icon: "CalendarClock", description: "Visitas técnicas e agendamentos", keywords: ["agenda", "visita", "instalação", "técnico"], criticality: "normal", permission: "all" },
  { nav_key: "visitas-tecnicas", label_default: "Visitas Técnicas", group_default: "Operações", order_default: 6, icon: "MapPin", description: "Calendário de visitas técnicas", keywords: ["visita", "técnica", "calendário", "agendamento", "campo"], criticality: "normal", permission: "all" },

  // ── 7. Financeiro ──
  { nav_key: "financeiro-dashboard", label_default: "Dashboard", group_default: "Financeiro", order_default: -1, icon: "TrendingUp", description: "Visão consolidada de receitas e comissões", keywords: ["financeiro", "dashboard", "receita", "visão geral"], criticality: "normal", permission: "admin_only" },
  { nav_key: "lancamentos", label_default: "Lançamentos", group_default: "Financeiro", order_default: -0.5, icon: "ArrowLeftRight", description: "Receitas e despesas avulsas", keywords: ["lançamento", "receita", "despesa", "avulso", "caixa", "entrada", "saída"], criticality: "normal", permission: "admin_only" },
  { nav_key: "recebimentos", label_default: "Recebimentos", group_default: "Financeiro", order_default: 0, icon: "DollarSign", description: "Controle de parcelas e pagamentos", keywords: ["pagamento", "parcela", "receber", "financeiro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inadimplencia", label_default: "Inadimplência", group_default: "Financeiro", order_default: 1, icon: "AlertTriangle", description: "Parcelas vencidas e cobranças", keywords: ["atraso", "devedor", "cobrança", "inadimplente"], criticality: "normal", permission: "admin_only" },
  { nav_key: "comissoes", label_default: "Comissões", group_default: "Financeiro", order_default: 2, icon: "Wallet", description: "Cálculo e controle de comissões", keywords: ["comissão", "consultor", "bonificação", "percentual"], criticality: "normal", permission: "admin_only" },
  { nav_key: "fechamento-caixa", label_default: "Fechamento de Caixa", group_default: "Financeiro", order_default: 2.5, icon: "Calculator", description: "Validação e consolidação de pagamentos por período", keywords: ["fechamento", "caixa", "consolidação", "período", "conferência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "fiscal", label_default: "Fiscal", group_default: "Financeiro", order_default: 3, icon: "ReceiptText", description: "Emissão de notas de serviço e importação de XMLs", keywords: ["nota", "fiscal", "NF", "NFS-e", "XML", "emissão", "serviço"], criticality: "normal", permission: "admin_only" },
  { nav_key: "financiamento", label_default: "Financiamentos", group_default: "Financeiro", order_default: 4, icon: "Building2", description: "Bancos, taxas e simulações de crédito", keywords: ["banco", "taxa", "parcela", "crédito", "financiar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "formas-pagamento", label_default: "Formas de Pagamento", group_default: "Financeiro", order_default: 4.5, icon: "CreditCard", description: "Juros, parcelas e condições por forma de pagamento", keywords: ["pagamento", "juros", "parcela", "cartão", "pix", "cheque", "boleto", "forma"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "engenharia", label_default: "Premissas Fiscais", group_default: "Financeiro", order_default: 5, icon: "Calculator", description: "ICMS, fio B, payback e análise tributária", keywords: ["ICMS", "fio B", "payback", "retorno", "tributo", "premissa"], criticality: "normal", permission: "admin_only" },
  { nav_key: "politica-precos", label_default: "Política de Preços", group_default: "Financeiro", order_default: 6, icon: "Shield", description: "Regras versionadas de precificação, margens e comissões", keywords: ["precificação", "margem", "comissão", "custo", "política", "pricing"], criticality: "business_critical", permission: "admin_only" },
  { nav_key: "integracao-asaas", label_default: "Integração Asaas", group_default: "Financeiro", order_default: 7, icon: "CreditCard", description: "Configuração de cobrança automática via Asaas", keywords: ["asaas", "cobrança", "boleto", "pix", "pagamento", "webhook", "gateway"], criticality: "normal", permission: "admin_only" },
  { nav_key: "asaas-conversao", label_default: "Conversão Asaas", group_default: "Financeiro", order_default: 8, icon: "BarChart3", description: "Funil de configuração da integração Asaas", keywords: ["asaas", "conversão", "funil", "configuração", "tracking"], criticality: "normal", permission: "admin_only" },
  { nav_key: "planos", label_default: "Planos", group_default: "Financeiro", order_default: 9, icon: "Sparkles", description: "Visualize e compare planos disponíveis", keywords: ["plano", "upgrade", "preço", "assinatura", "billing"], criticality: "normal", permission: "all" },
  { nav_key: "planos-servico", label_default: "Planos de Serviço", group_default: "Financeiro", order_default: 10, icon: "CreditCard", description: "Configure planos de serviço para cobrança de clientes", keywords: ["plano", "serviço", "cobrança", "mensalidade", "monitoramento", "manutenção"], criticality: "normal", permission: "admin_only" },

  // ── 8. Equipe ──
  { nav_key: "vendedores", label_default: "Consultores", group_default: "Equipe", order_default: 0, icon: "Users", description: "Cadastro e gestão de consultores", keywords: ["consultor", "consultora", "consultores", "equipe", "cadastro"], criticality: "normal", permission: "admin_only" },
  { nav_key: "gamificacao", label_default: "Gamificação", group_default: "Equipe", order_default: 1, icon: "Trophy", description: "Metas, pontuação e ranking da equipe", keywords: ["meta", "ranking", "conquista", "pontuação", "competição", "gamificação"], criticality: "normal", permission: "admin_only" },

  // ── 9. IA ──
  { nav_key: "diretor", label_default: "Copilot IA", group_default: "IA", order_default: 0, icon: "Sparkles", description: "Análises inteligentes e sugestões automáticas", keywords: ["IA", "copilot", "sugestão", "automático", "inteligência", "assistente"], criticality: "normal", permission: "all" },
  { nav_key: "ai-config", label_default: "Configuração de IA", group_default: "IA", order_default: 1, icon: "Brain", description: "Modelo, temperatura e regras de IA", keywords: ["ia", "ai", "openai", "gpt", "modelo", "inteligência", "artificial", "configuração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "openai-config", label_default: "Config OpenAI", group_default: "IA", order_default: 5, icon: "Brain", description: "Chave de API e configurações OpenAI", keywords: ["openai", "gpt", "api", "chave", "token"], criticality: "normal", permission: "admin_only" },
  { nav_key: "gemini-config", label_default: "Config Gemini", group_default: "IA", order_default: 6, icon: "Sparkles", description: "Chave de API e configurações Google Gemini", keywords: ["gemini", "google", "api", "chave", "modelo"], criticality: "normal", permission: "admin_only" },

  { nav_key: "energia-dashboard", label_default: "Dashboard Energia", group_default: "Energia", order_default: -1, icon: "Zap", description: "Visão consolidada de todas as UCs, geração, consumo e alertas", keywords: ["dashboard", "energia", "UC", "geração", "consumo", "consolidado"], criticality: "business_critical", permission: "admin_only" },
  { nav_key: "ucs", label_default: "Unidades Consumidoras", group_default: "Energia", order_default: 0, icon: "Building2", description: "Gestão de UCs", keywords: ["UC", "unidade", "consumidora", "energia", "concessionária"], criticality: "normal", permission: "admin_only" },
  { nav_key: "monitoramento", label_default: "Monitoramento Solar", group_default: "Energia", order_default: 1, icon: "BarChart3", description: "Dashboard de monitoramento solar em tempo real", keywords: ["monitoramento", "solar", "dashboard", "energia", "geração", "usina"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "monitoramento/usinas", label_default: "Usinas", group_default: "Energia", order_default: 2, icon: "Sun", description: "Mapa e lista de usinas fotovoltaicas", keywords: ["usina", "planta", "mapa", "lista", "solar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "monitoramento/alertas", label_default: "Alertas", group_default: "Energia", order_default: 3, icon: "AlertTriangle", description: "Central de alertas das usinas", keywords: ["alerta", "offline", "falha", "inversor", "comunicação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "monitoramento/relatorios", label_default: "Relatórios", group_default: "Energia", order_default: 4, icon: "FileText", description: "Relatórios de geração e performance", keywords: ["relatório", "geração", "performance", "csv", "exportar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "faturas-energia", label_default: "Faturas de Energia", group_default: "Energia", order_default: 5, icon: "Mail", description: "Recebimento automático de faturas por e-mail via Gmail", keywords: ["fatura", "energia", "gmail", "conta", "concessionária", "e-mail"], criticality: "normal", permission: "admin_only" },
  { nav_key: "central-extracao", label_default: "Central de Extração", group_default: "Energia", order_default: 6, icon: "Settings2", description: "Configure estratégia de extração de dados por concessionária", keywords: ["extração", "parser", "concessionária", "OCR", "provedor", "infosimples", "configuração"], criticality: "normal", permission: "admin_only" },
  // gd-rateio removida — funcionalidade migrada para aba Beneficiárias na UC
  { nav_key: "alertas-energia", label_default: "Alertas Energéticos", group_default: "Energia", order_default: 7, icon: "Zap", description: "Alertas automáticos de geração, faturas e rateio", keywords: ["alerta", "energia", "geração", "fatura", "rateio", "medidor", "divergência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "automacoes-energia", label_default: "Automações Energéticas", group_default: "Energia", order_default: 8, icon: "Zap", description: "Fila de recálculo automático de grupos GD", keywords: ["automação", "recálculo", "fila", "engine", "GD", "energia"], criticality: "normal", permission: "admin_only" },
  { nav_key: "financeiro-energia", label_default: "Financeiro da Energia", group_default: "Energia", order_default: 9, icon: "DollarSign", description: "Economia, compensação e valor gerado por clientes e grupos GD", keywords: ["financeiro", "economia", "energia", "compensação", "valor", "ranking"], criticality: "normal", permission: "admin_only" },
  { nav_key: "painel-cliente-energia", label_default: "Painel do Cliente", group_default: "Energia", order_default: 10, icon: "Zap", description: "Visão do cliente final: economia, créditos, faturas e desempenho", keywords: ["cliente", "painel", "dashboard", "energia", "economia", "portal"], criticality: "normal", permission: "admin_only" },
  { nav_key: "solarmarket", label_default: "SolarMarket Importação", group_default: "Integrações", order_default: 2, icon: "Sun", description: "Importar clientes, projetos e propostas do SolarMarket", keywords: ["solarmarket", "importar", "cliente", "projeto", "proposta", "sincronizar"], criticality: "normal", permission: "admin_only" },

  // ── 11. Integrações ──
  { nav_key: "catalogo-integracoes", label_default: "Catálogo de Integrações", group_default: "Integrações", order_default: 0, icon: "Plug", description: "Catálogo completo de integrações disponíveis", keywords: ["integração", "catálogo", "provider", "conectar", "solar", "crm", "pagamento", "webhook", "openai", "gemini", "whatsapp", "meta", "google", "maps", "agenda", "instagram", "automação", "webhook", "asaas"], criticality: "normal", permission: "admin_only" },
  { nav_key: "integracoes-email", label_default: "Integrações de E-mail", group_default: "Integrações", order_default: 1, icon: "Mail", description: "Gerencie contas de e-mail e ingestão automática de faturas", keywords: ["email", "e-mail", "gmail", "imap", "fatura", "ingestão", "conta"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meta-dashboard", label_default: "Meta Ads Dashboard", group_default: "_hidden", order_default: 33, icon: "BarChart3", description: "Métricas de campanhas Meta/Facebook Ads", keywords: ["meta", "facebook", "ads", "campanha", "anúncio", "marketing"], criticality: "normal", permission: "admin_only" },
  { nav_key: "monitoramento/integracoes", label_default: "Integrações Monitoramento", group_default: "_hidden", order_default: 34, icon: "Plug", description: "Configuração de provedores de monitoramento", keywords: ["provider", "solarman", "solaredge", "solis", "deye", "integração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "medidores", label_default: "Medidores", group_default: "Energia", order_default: 7, icon: "Gauge", description: "Dispositivos de medição IoT sincronizados via API", keywords: ["medidor", "meter", "tuya", "IoT", "smart meter"], criticality: "normal", permission: "admin_only" },
  { nav_key: "wa-health", label_default: "Saúde WhatsApp", group_default: "_hidden", order_default: 35, icon: "Activity", description: "Status e saúde das conexões WhatsApp", keywords: ["whatsapp", "saúde", "health", "status", "conexão"], criticality: "normal", permission: "admin_only" },
  { nav_key: "payment-gateway", label_default: "Gateway de Pagamento", group_default: "_hidden", order_default: 36, icon: "CreditCard", description: "Configuração de gateway de pagamento (Asaas)", keywords: ["pagamento", "gateway", "asaas", "boleto", "pix", "cobrança"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meta-facebook-config", label_default: "Config Meta/Facebook", group_default: "_hidden", order_default: 37, icon: "Globe", description: "Credenciais e configuração Meta/Facebook Ads", keywords: ["meta", "facebook", "ads", "configuração", "token", "pixel"], criticality: "normal", permission: "admin_only" },

  // ── 12. Site ──
  { nav_key: "site-config", label_default: "Conteúdo & Visual", group_default: "Site", order_default: 0, icon: "Globe", description: "Aparência, branding e identidade visual", keywords: ["site", "branding", "cores", "logo", "identidade", "visual"], criticality: "normal", permission: "admin_only" },
  { nav_key: "site-servicos", label_default: "Serviços", group_default: "Site", order_default: 1, icon: "Briefcase", description: "Serviços exibidos na página institucional", keywords: ["serviço", "oferta", "página", "institucional"], criticality: "normal", permission: "admin_only" },
  { nav_key: "obras", label_default: "Portfólio", group_default: "Site", order_default: 2, icon: "Image", description: "Galeria de projetos instalados", keywords: ["obra", "portfólio", "galeria", "projeto", "foto", "instalação"], criticality: "normal", permission: "admin_only" },

  // ── 13. Cadastros ──
  { nav_key: "equipamentos", label_default: "Disjuntores & Transf.", group_default: "Cadastros", order_default: 0, icon: "Package", description: "Equipamentos elétricos de proteção", keywords: ["disjuntor", "transformador", "proteção", "elétrico", "equipamento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "modulos", label_default: "Módulos Fotovoltaicos", group_default: "Cadastros", order_default: 1, icon: "Sun", description: "Catálogo de painéis e módulos solares", keywords: ["módulo", "painel", "placa", "solar", "fotovoltaico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "inversores-cadastro", label_default: "Inversores", group_default: "Cadastros", order_default: 2, icon: "Cpu", description: "Catálogo de inversores solares", keywords: ["inversor", "string", "microinversor", "potência"], criticality: "normal", permission: "admin_only" },
  { nav_key: "baterias", label_default: "Baterias", group_default: "Cadastros", order_default: 3, icon: "Battery", description: "Catálogo de baterias e armazenamento", keywords: ["bateria", "armazenamento", "storage", "energia"], criticality: "normal", permission: "admin_only" },
  { nav_key: "otimizadores", label_default: "Otimizadores", group_default: "Cadastros", order_default: 3.5, icon: "Zap", description: "Catálogo de otimizadores de potência", keywords: ["otimizador", "optimizer", "solaredge", "potência", "mppt"], criticality: "normal", permission: "admin_only" },
  { nav_key: "fornecedores", label_default: "Fornecedores", group_default: "Cadastros", order_default: 4, icon: "Truck", description: "Distribuidores e fabricantes", keywords: ["fornecedor", "distribuidor", "fabricante", "integrador", "equipamento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "concessionarias", label_default: "Concessionárias", group_default: "Cadastros", order_default: 5, icon: "Building", description: "Distribuidoras de energia e tarifas", keywords: ["concessionária", "distribuidora", "tarifa", "energia", "ICMS"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "dicionario-aneel", label_default: "Dicionário ANEEL", group_default: "Cadastros", order_default: 6, icon: "FileSearch", description: "Mapeamento ANEEL ↔ Concessionárias", keywords: ["aneel", "dicionário", "match", "alias", "mapeamento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "tarifa-versoes", label_default: "Versões de Tarifa", group_default: "Cadastros", order_default: 7, icon: "History", description: "Versionamento, diff e rollback de tarifas", keywords: ["versão", "tarifa", "rollback", "diff", "histórico", "ativar"], criticality: "normal", permission: "admin_only" },
  { nav_key: "saude-tarifaria", label_default: "Saúde Tarifária", group_default: "Energia", order_default: 9, icon: "Activity", description: "Alertas, cobertura e governança de tarifas", keywords: ["saúde", "alerta", "vigência", "zero", "governança", "diagnóstico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "aneel-sync-status", label_default: "Status Sync ANEEL", group_default: "Energia", order_default: 10, icon: "Zap", description: "Monitoramento em tempo real do sync ANEEL", keywords: ["sync", "aneel", "status", "log", "run", "versão"], criticality: "normal", permission: "admin_only" },
  { nav_key: "conf-solar", label_default: "Config Solar", group_default: "Energia", order_default: 12, icon: "Settings", description: "Premissas e configurações de dimensionamento solar", keywords: ["solar", "configuração", "premissa", "dimensionamento", "cálculo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "premissas", label_default: "Premissas", group_default: "Cadastros", order_default: 10, icon: "Sliders", description: "Parâmetros financeiros, técnicos e valores padrões", keywords: ["premissas", "financeiras", "telhado", "irradiância", "tarifa", "padrão", "defaults"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "meteorologia", label_default: "Base Meteorológica", group_default: "Cadastros", order_default: 11, icon: "Database", description: "Dados de irradiância solar e importação", keywords: ["irradiância", "solar", "dataset", "INPE", "NASA", "importação", "GHI", "meteorológica"], criticality: "normal", permission: "admin_only" },

  // ── 14. Configurações ──
  { nav_key: "config", label_default: "Calculadora Solar", group_default: "Site", order_default: 5, icon: "Calculator", description: "Parâmetros de cálculo de geração e payback", keywords: ["calculadora", "cálculo", "geração", "payback", "simulação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "lead-status", label_default: "Status de Leads", group_default: "Configurações", order_default: 1, icon: "Kanban", description: "Personalizar etapas do funil", keywords: ["etapa", "funil", "personalizar", "status"], criticality: "normal", permission: "admin_only" },
  { nav_key: "motivos-perda", label_default: "Motivos de Perda", group_default: "Configurações", order_default: 2, icon: "XCircle", description: "Razões de perda de negócios", keywords: ["perda", "motivo", "relatório", "análise"], criticality: "normal", permission: "admin_only" },
  { nav_key: "loading-config", label_default: "Loading & Mensagens", group_default: "Configurações", order_default: 3, icon: "Sun", description: "Animação e mensagens de carregamento", keywords: ["loading", "carregamento", "mensagem", "animação", "sol", "loader"], criticality: "normal", permission: "admin_only" },
  
  { nav_key: "mensagens-proposta", label_default: "Mensagens da Proposta", group_default: "Configurações", order_default: 5, icon: "MessageCircle", description: "Templates, blocos e padrões de mensagens de proposta", keywords: ["mensagem", "proposta", "template", "whatsapp", "email", "configuração"], criticality: "normal", permission: "admin_only" },

  // ── 15. Administração ──
  { nav_key: "tenant-settings", label_default: "Empresa", group_default: "Administração", order_default: 0, icon: "Building2", description: "Identidade, localização, branding e regras gerais", keywords: ["empresa", "cnpj", "tenant", "configuração", "crm", "cadastro", "branding"], criticality: "normal", permission: "admin_only" },
  { nav_key: "usuarios", label_default: "Usuários & Permissões", group_default: "Administração", order_default: 1, icon: "Shield", description: "Controle de acessos e papéis", keywords: ["usuário", "permissão", "role", "acesso"], criticality: "system_critical", permission: "admin_only" },
  { nav_key: "permissoes", label_default: "Permissões por Papel", group_default: "Administração", order_default: 2, icon: "Shield", description: "Configurar acesso de cada papel aos módulos", keywords: ["permissão", "role", "papel", "acesso", "módulo"], criticality: "system_critical", permission: "admin_only" },
  { nav_key: "auditoria", label_default: "Auditoria (Logs)", group_default: "Administração", order_default: 3, icon: "FileSearch", description: "Histórico completo de alterações no sistema", keywords: ["log", "auditoria", "histórico", "alteração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "notificacoes-config", label_default: "Notificações", group_default: "Administração", order_default: 4, icon: "Bell", description: "Configurar alertas e notificações da empresa", keywords: ["notificação", "push", "alerta", "configurar", "ativar"], criticality: "normal", permission: "admin_only", separator: true },
  { nav_key: "links-instalacao", label_default: "Links & Captação", group_default: "Administração", order_default: 5, icon: "Smartphone", description: "Links de captação, QR Codes e instalação PWA", keywords: ["PWA", "link", "instalação", "app", "canal", "captação", "qr", "code", "whatsapp"], criticality: "normal", permission: "admin_only" },
  { nav_key: "release", label_default: "Release Notes", group_default: "_hidden", order_default: 40, icon: "Rocket", description: "Controle de entregas e lançamentos", keywords: ["versão", "release", "novidade"], criticality: "normal", permission: "admin_only" },
  { nav_key: "changelog", label_default: "Atualizações", group_default: "Administração", order_default: 7, icon: "History", description: "Novidades e melhorias recentes", keywords: ["changelog", "atualização", "novidade", "versão", "histórico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "menus", label_default: "Personalizar Menus", group_default: "Administração", order_default: 8, icon: "LayoutList", description: "Reorganizar e ocultar itens do menu lateral", keywords: ["menu", "sidebar", "organizar", "ocultar", "personalizar", "navegação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "data-reset", label_default: "Limpeza de Dados", group_default: "Administração", order_default: 9, icon: "Trash2", description: "Limpeza seletiva e reset de dados", keywords: ["reset", "limpeza", "deletar", "remover", "manutenção"], criticality: "normal", permission: "admin_only" },
  { nav_key: "backup", label_default: "Backup de Dados", group_default: "Administração", order_default: 10, icon: "HardDrive", description: "Exportar dados do tenant para backup seguro (somente banco de dados)", keywords: ["backup", "exportar", "dados", "segurança", "json"], criticality: "normal", permission: "admin_only" },

  // ── Campos Customizados (Configurações) ──
  { nav_key: "custom-fields", label_default: "Campos Customizados", group_default: "Configurações", order_default: 4, icon: "Settings2", description: "Campos personalizados para leads e projetos", keywords: ["campo", "customizado", "personalizado", "opção"], criticality: "normal", permission: "admin_only" },

  // ── Proposta Comercial (Comercial - legacy) ──
  { nav_key: "proposta-comercial", label_default: "Editor de Proposta", group_default: "Comercial", order_default: 13, icon: "PenTool", description: "Editor visual de templates de proposta", keywords: ["proposta", "comercial", "editor", "visual", "template"], criticality: "normal", permission: "admin_only" },

  // ── Items kept for routing but hidden from sidebar ──
  { nav_key: "meta-leads", label_default: "Leads", group_default: "_hidden", order_default: 0, icon: "UserPlus", description: "Leads via Facebook Lead Ads", keywords: ["meta", "facebook", "lead"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meta-campaigns", label_default: "Campanhas", group_default: "_hidden", order_default: 1, icon: "Megaphone", description: "Campanhas ativas", keywords: ["meta", "campanha"], criticality: "normal", permission: "admin_only" },
  { nav_key: "meta-config", label_default: "Configuração", group_default: "_hidden", order_default: 2, icon: "Settings", description: "Credenciais Meta", keywords: ["meta", "config"], criticality: "normal", permission: "admin_only" },
  { nav_key: "depositos", label_default: "Depósitos", group_default: "_hidden", order_default: 5, icon: "Warehouse", description: "Locais de armazenamento", keywords: ["depósito", "almoxarifado"], criticality: "normal", permission: "admin_only" },
  { nav_key: "categorias-estoque", label_default: "Categorias", group_default: "_hidden", order_default: 6, icon: "Tag", description: "Categorias de estoque", keywords: ["categoria", "subcategoria"], criticality: "normal", permission: "admin_only" },
  { nav_key: "n8n", label_default: "Automações n8n", group_default: "_hidden", order_default: 10, icon: "Workflow", description: "Placeholder n8n", keywords: ["n8n", "automação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "contatos", label_default: "Contatos", group_default: "_hidden", order_default: 11, icon: "Contact", description: "Página de contatos (em desenvolvimento)", keywords: ["contato"], criticality: "normal", permission: "admin_only" },
  { nav_key: "documentos", label_default: "Documentos", group_default: "_hidden", order_default: 12, icon: "FileText", description: "Alias de documentos-assinaturas", keywords: ["documento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "integracoes", label_default: "Integrações (legacy)", group_default: "_hidden", order_default: 13, icon: "Plug", description: "Página legada de integrações", keywords: ["integração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "monitoramento-solar", label_default: "Monitoramento Solar (legacy)", group_default: "_hidden", order_default: 14, icon: "Sun", description: "Redirect para monitoramento/integracoes", keywords: ["monitoramento"], criticality: "normal", permission: "admin_only" },
  { nav_key: "insumos-irradiacao", label_default: "Insumos Irradiação", group_default: "_hidden", order_default: 15, icon: "Sun", description: "Redirect para meteorologia", keywords: ["irradiação"], criticality: "normal", permission: "admin_only" },
  { nav_key: "irradiancia", label_default: "Irradiância", group_default: "_hidden", order_default: 16, icon: "Sun", description: "Redirect para meteorologia", keywords: ["irradiância"], criticality: "normal", permission: "admin_only" },
  { nav_key: "base-meteorologica", label_default: "Base Meteorológica", group_default: "_hidden", order_default: 17, icon: "Cloud", description: "Redirect para meteorologia", keywords: ["meteorológica"], criticality: "normal", permission: "admin_only" },
  { nav_key: "aneel", label_default: "ANEEL", group_default: "_hidden", order_default: 18, icon: "FileText", description: "Redirect para concessionárias", keywords: ["aneel"], criticality: "normal", permission: "admin_only" },
  { nav_key: "instagram", label_default: "Instagram", group_default: "_hidden", order_default: 19, icon: "Camera", description: "Redirect para catálogo de integrações", keywords: ["instagram"], criticality: "normal", permission: "admin_only" },
  { nav_key: "webhooks", label_default: "Webhooks", group_default: "_hidden", order_default: 20, icon: "Webhook", description: "Redirect para catálogo de integrações", keywords: ["webhook"], criticality: "normal", permission: "admin_only" },
  { nav_key: "saude-integracoes", label_default: "Saúde Integrações", group_default: "_hidden", order_default: 21, icon: "Activity", description: "Redirect para catálogo de integrações", keywords: ["saúde", "integração"], criticality: "normal", permission: "admin_only" },
  { nav_key: "pricing-policy", label_default: "Política de Preços (legacy)", group_default: "_hidden", order_default: 22, icon: "Shield", description: "Página de política de preços", keywords: ["preço", "política"], criticality: "normal", permission: "admin_only" },

  // ── 15. Administração (cont.) ──
  { nav_key: "cron-jobs", label_default: "Tarefas Agendadas", group_default: "Administração", order_default: 55, icon: "Timer", description: "Status das tarefas cron do sistema", keywords: ["cron", "agendamento", "tarefa", "job", "scheduler"], criticality: "normal", permission: "admin_only" },
  { nav_key: "planos-features", label_default: "Planos e Features", group_default: "Administração", order_default: 56, icon: "CreditCard", description: "Gestão de planos, features e acesso por tenant", keywords: ["plano", "feature", "billing", "monetização", "assinatura", "acesso"], criticality: "normal", permission: "admin_only" },
  { nav_key: "dashboard-comercial", label_default: "Dashboard Comercial", group_default: "Administração", order_default: 57, icon: "TrendingUp", description: "Uso, limites e oportunidades de upgrade por tenant", keywords: ["comercial", "uso", "limite", "upgrade", "upsell", "consumo"], criticality: "normal", permission: "admin_only" },
  { nav_key: "funil-propostas", label_default: "Funil de Propostas", group_default: "Comercial", order_default: 15, icon: "BarChart3", description: "Métricas de conversão, visualização e propostas quentes", keywords: ["funil", "proposta", "conversão", "comercial", "tracking", "quente"], criticality: "normal", permission: "all" },
  { nav_key: "pricing", label_default: "Otimização de Preços", group_default: "Administração", order_default: 58, icon: "FlaskConical", description: "A/B test de preços e métricas de conversão", keywords: ["pricing", "preço", "ab test", "variante", "conversão", "otimização"], criticality: "normal", permission: "admin_only" },
  { nav_key: "system-health", label_default: "Saúde do Sistema", group_default: "Administração", order_default: 60, icon: "HeartPulse", description: "Status geral e diagnóstico do sistema", keywords: ["saúde", "sistema", "health", "status", "diagnóstico"], criticality: "normal", permission: "admin_only" },
  { nav_key: "lixeira", label_default: "Lixeira", group_default: "Administração", order_default: 62, icon: "Trash2", description: "Leads e registros excluídos", keywords: ["lixeira", "excluído", "deletado", "recuperar"], criticality: "normal", permission: "admin_only" },
];

// ─── SECTION DEFAULTS ────────────────────────────────────────

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

const ACTIVE = (color: string) => `bg-sidebar-${color}/12 text-sidebar-${color} font-semibold border-l-2 border-sidebar-${color}`;
const HOVER = (color: string) => `hover:bg-sidebar-${color}/6`;
const LABEL = (color: string) => `text-sidebar-${color}`;

export const NAV_SECTION_DEFAULTS: NavSectionMeta[] = [
  { label: "Painel",           icon: "BarChart3",      order: 0,   indicatorBg: "bg-sidebar-intelligence",  indicatorClass: "bg-primary/10 text-primary",               iconColor: "text-primary",              activeClass: ACTIVE("intelligence"),  hoverClass: HOVER("intelligence"),  labelClass: LABEL("intelligence"),  defaultOpen: true },
  { label: "Comercial",        icon: "TrendingUp",     order: 1,   indicatorBg: "bg-sidebar-commercial",    indicatorClass: "bg-primary/10 text-primary",               iconColor: "text-primary",              activeClass: ACTIVE("commercial"),    hoverClass: HOVER("commercial"),    labelClass: LABEL("commercial"),    defaultOpen: true },
  { label: "Atendimento",      icon: "MessageCircle",  order: 2,   indicatorBg: "bg-sidebar-atendimento",   indicatorClass: "bg-info/10 text-info",                     iconColor: "text-info",                 activeClass: ACTIVE("atendimento"),   hoverClass: HOVER("atendimento"),   labelClass: LABEL("atendimento"),   defaultOpen: true },
  { label: "Clientes",         icon: "UserCheck",      order: 3,   indicatorBg: "bg-sidebar-clients",       indicatorClass: "bg-success/10 text-success",               iconColor: "text-success",              activeClass: ACTIVE("clients"),       hoverClass: HOVER("clients"),       labelClass: LABEL("clients"),       defaultOpen: true },
  { label: "Pós-Venda",        icon: "Wrench",         order: 4,   indicatorBg: "bg-sidebar-operations",    indicatorClass: "bg-warning/10 text-warning",               iconColor: "text-warning",              activeClass: ACTIVE("operations"),    hoverClass: HOVER("operations"),    labelClass: LABEL("operations"),    defaultOpen: false },
  { label: "Operações",        icon: "Wrench",         order: 5,   indicatorBg: "bg-sidebar-operations",    indicatorClass: "bg-warning/10 text-warning",               iconColor: "text-warning",              activeClass: ACTIVE("operations"),    hoverClass: HOVER("operations"),    labelClass: LABEL("operations"),    defaultOpen: false },
  { label: "Financeiro",       icon: "Wallet",         order: 6,   indicatorBg: "bg-sidebar-finance",       indicatorClass: "bg-success/10 text-success",               iconColor: "text-success",              activeClass: ACTIVE("finance"),       hoverClass: HOVER("finance"),       labelClass: LABEL("finance"),       defaultOpen: false },
  { label: "Equipe",           icon: "Users",          order: 7,   indicatorBg: "bg-sidebar-team",          indicatorClass: "bg-primary/10 text-primary",               iconColor: "text-primary",              activeClass: ACTIVE("team"),          hoverClass: HOVER("team"),          labelClass: LABEL("team"),          defaultOpen: false },
  { label: "IA",               icon: "Bot",            order: 8,   indicatorBg: "bg-sidebar-ai",            indicatorClass: "bg-info/10 text-info",                     iconColor: "text-info",                 activeClass: ACTIVE("ai"),            hoverClass: HOVER("ai"),            labelClass: LABEL("ai"),            defaultOpen: false },
  { label: "Energia",          icon: "Zap",            order: 9,   indicatorBg: "bg-sidebar-energy",        indicatorClass: "bg-warning/10 text-warning",               iconColor: "text-warning",              activeClass: ACTIVE("energy"),        hoverClass: HOVER("energy"),        labelClass: LABEL("energy"),        defaultOpen: false },
  { label: "Integrações",      icon: "Plug",           order: 10,  indicatorBg: "bg-sidebar-settings",      indicatorClass: "bg-info/10 text-info",                     iconColor: "text-info",                 activeClass: ACTIVE("settings"),      hoverClass: HOVER("settings"),      labelClass: LABEL("settings"),      defaultOpen: false },
  { label: "Site",             icon: "Globe",          order: 11,  indicatorBg: "bg-sidebar-marketing",     indicatorClass: "bg-primary/10 text-primary",               iconColor: "text-primary",              activeClass: ACTIVE("marketing"),     hoverClass: HOVER("marketing"),     labelClass: LABEL("marketing"),     defaultOpen: false },
  { label: "Cadastros",        icon: "Database",       order: 12,  indicatorBg: "bg-sidebar-cadastros",     indicatorClass: "bg-muted text-muted-foreground",           iconColor: "text-muted-foreground",     activeClass: ACTIVE("cadastros"),     hoverClass: HOVER("cadastros"),     labelClass: LABEL("cadastros"),     defaultOpen: false },
  { label: "Configurações",    icon: "Settings",       order: 13,  indicatorBg: "bg-sidebar-settings",      indicatorClass: "bg-muted text-muted-foreground",           iconColor: "text-muted-foreground",     activeClass: ACTIVE("settings"),      hoverClass: HOVER("settings"),      labelClass: LABEL("settings"),      defaultOpen: false },
  { label: "Administração",    icon: "Shield",         order: 14,  indicatorBg: "bg-sidebar-settings",      indicatorClass: "bg-destructive/10 text-destructive",       iconColor: "text-destructive",          activeClass: ACTIVE("settings"),      hoverClass: HOVER("settings"),      labelClass: LABEL("settings"),      defaultOpen: false },
];

// ─── HELPERS ─────────────────────────────────────────────────

/** Lookup by nav_key */
const REGISTRY_MAP = new Map(NAV_REGISTRY.map((r) => [r.nav_key, r]));

export function getRegistryItem(navKey: string): NavRegistryItem | undefined {
  return REGISTRY_MAP.get(navKey);
}

/** Lookup section meta by label */
const SECTION_MAP = new Map(NAV_SECTION_DEFAULTS.map((s) => [s.label, s]));

export function getSectionMeta(label: string): NavSectionMeta | undefined {
  return SECTION_MAP.get(label);
}

/** All unique group names (in order) */
export function getGroupNames(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of NAV_REGISTRY) {
    if (item.group_default === "_hidden") continue;
    if (!seen.has(item.group_default)) {
      seen.add(item.group_default);
      out.push(item.group_default);
    }
  }
  return out;
}
