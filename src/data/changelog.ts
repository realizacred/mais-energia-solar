/**
 * Changelog do Sistema — Fonte de verdade única.
 * Toda atualização significativa deve ser registrada aqui.
 * Formato: mais recente primeiro.
 *
 * REGRA (ver AGENTS.md §31): Ao concluir qualquer feature, melhoria,
 * correção ou mudança de infra significativa, o AI Agent DEVE adicionar
 * uma entrada aqui com version bump, data, título, descrição e details.
 */

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  type: "feature" | "improvement" | "bugfix" | "security" | "infra";
  details?: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.14.4",
    date: "2026-03-11",
    title: "Status 'gerada' só é atribuído após geração real do template",
    type: "bugfix",
    description: "Corrigido bug onde 'Salvar como Ativa' marcava a proposta como 'gerada' prematuramente, antes da geração do template. Agora apenas a edge function proposal-generate define esse status.",
    details: [
      "Removido propostaUpdate.status = 'gerada' do frontend (useWizardPersistence)",
      "Status 'gerada' continua sendo definido corretamente pela edge function proposal-generate",
      "Proposta permanece como 'rascunho' até que o template seja efetivamente gerado",
    ],
  },
  {
    version: "2.14.3",
    date: "2026-03-11",
    title: "Substituição robusta de placeholders em templates DOCX",
    type: "bugfix",
    description: "Reescrita completa do motor de substituição de variáveis DOCX para lidar com qualquer forma de fragmentação de runs pelo Word.",
    details: [
      "Nova função normalizeParagraphRuns() mescla runs fragmentados parágrafo a parágrafo",
      "Corrige placeholders divididos como ['[', 'responsavel_nome]'], ['[inversor_fabricante_1', ']'], etc.",
      "Preserva formatação (bold, italic) do primeiro run do grupo mesclado",
      "7 testes unitários cobrindo todos os cenários de fragmentação",
      "Removida a antiga replaceSplitPlaceholders() que falhava em casos de quebra complexa",
    ],
  },
  {
    version: "2.14.2",
    date: "2026-03-11",
    title: "Variáveis nulas não quebram mais a geração de PDF/HTML",
    type: "bugfix",
    description: "Variáveis ausentes ou null em templates DOCX e HTML agora são substituídas silenciosamente por valor vazio, sem interromper a geração do documento.",
    details: [
      "DOCX: placeholders [variavel] sem valor são removidos silenciosamente do documento final",
      "HTML: helper safe() previne 'undefined'/'null' de aparecer no HTML renderizado",
      "Log silencioso de variáveis faltantes para debug (console.warn no servidor)",
      "Formatadores fmt()/fmtPct() agora aceitam null/undefined sem erro",
    ],
  },
  {
    version: "2.14.1",
    date: "2026-03-11",
    title: "Correção crítica: normalização de grupo tarifário na criação de propostas",
    type: "bugfix",
    description: "Corrige erro 'proposta_versoes_grupo_check' que impedia a geração de propostas na etapa 8 do wizard quando o grupo tarifário continha subgrupo (B1, B2, A4, etc).",
    details: [
      "RPC create_proposta_nativa_atomic agora normaliza grupo para 'A' ou 'B' antes do INSERT",
      "sanitizeSnapshot() no frontend também normaliza grupo como defesa em profundidade",
      "Documentação §33 do AGENTS.md atualizada com regra de normalização em todos os caminhos",
    ],
  },
  {
    version: "2.14.0",
    date: "2026-03-10",
    title: "Padronização Visual Completa (AGENTS.md Compliance)",
    type: "improvement",
    description: "Auditoria e refatoração de múltiplas telas admin para conformidade total com AGENTS.md: headers §26, padding §6, animações §7, cards §3 e skeletons §12.",
    details: [
      "Página Release Checklist refatorada com header padrão e Skeleton loading",
      "Página Google Maps Config refatorada com motion.div e staleTime",
      "Página Links & Captação refatorada com componentes modulares",
      "Página Notificações Config refatorada com Switch auto-save",
      "Página Changelog refatorada com timeline animada",
    ],
  },
  {
    version: "2.13.0",
    date: "2026-03-05",
    title: "Pós-Venda: Dashboard e Preventivas",
    type: "feature",
    description: "Módulo completo de pós-venda com dashboard de indicadores, gestão de manutenções preventivas e planos de manutenção.",
    details: [
      "Dashboard com KPIs de instalações ativas, preventivas pendentes e NPS",
      "CRUD de manutenções preventivas com agendamento recorrente",
      "Gestão de planos de manutenção vinculados a clientes",
      "Checklists de pós-venda com templates configuráveis",
    ],
  },
  {
    version: "2.12.0",
    date: "2026-02-28",
    title: "Monitoramento Solar e Integrações",
    type: "feature",
    description: "Painel de monitoramento de usinas solares com integração a inversores, alertas automáticos e relatórios de geração.",
    details: [
      "Dashboard de monitoramento com gráficos de geração em tempo real",
      "Cadastro de usinas com vinculação a clientes e projetos",
      "Sistema de alertas configuráveis por limiar de geração",
      "Integração com SolarMarket para importação de dados",
    ],
  },
  {
    version: "2.11.0",
    date: "2026-02-16",
    title: "Módulo Fiscal, Webhooks Asaas e Correção de Agenda",
    type: "feature",
    description: "Central fiscal com emissão de NFS-e vinculada a recebimentos, importação de XMLs de fornecedores, automação de baixa via Webhook Asaas e correção global de CORS no Google Calendar.",
    details: [
      "Gestão Fiscal com abas de Emissões (Saída) e XMLs (Entrada)",
      "Dropzone para importação de XMLs de compra de kits",
      "Webhook Asaas para baixa automática de parcelas",
      "Correção de headers CORS em 11 Edge Functions",
      "Smart Beacon no botão 'Tirar Nota' para onboarding",
    ],
  },
  {
    version: "2.10.2",
    date: "2026-02-12",
    title: "Correção: Banner de Push e Toast de Login",
    type: "bugfix",
    description: "Banner de ativação push não aparece mais para quem já tem notificações ativas. Toast 'Login necessário' não exibe mais após login bem-sucedido.",
    details: [
      "Hook useWebPushSubscription agora expõe 'isReady' para evitar flash do banner",
      "Leitura síncrona de Notification.permission antes da verificação async do SW",
      "Toast de redirect só aparece quando usuário NÃO está logado",
    ],
  },
  {
    version: "2.10.1",
    date: "2026-02-12",
    title: "Feedback ao Ativar/Desativar Notificações",
    type: "improvement",
    description: "Switch de notificações agora salva automaticamente no servidor e mostra confirmação visual (toast) de sucesso ou erro.",
    details: [
      "Auto-save ao alternar switch com rollback em caso de erro",
      "Toast diferenciado: 'Notificações ativadas ✅' ou 'Notificações desativadas 🔕'",
    ],
  },
  {
    version: "2.10.0",
    date: "2026-02-12",
    title: "Links & PWA: Correções e Melhorias",
    type: "bugfix",
    description: "Correção de links exibindo código 'admin' no portal do consultor. Portal do Instalador removido da view de consultor. PWA do WhatsApp visível para consultores.",
    details: [
      "VendorLinksView agora passa dados corretos do vendedor logado",
      "Prop isAdminView controla visibilidade do Portal do Instalador",
      "Link de cadastro de leads mostra slug real do consultor",
      "Seção 'Meu Link de Cadastro de Leads' personalizada para consultores",
    ],
  },
  {
    version: "2.9.2",
    date: "2026-02-12",
    title: "Diagnóstico de Push Notifications",
    type: "feature",
    description: "Painel de saúde que verifica 6 camadas do sistema de push: browser, permissão, SW, PushManager, backend e config global.",
    details: [
      "Verificação automática ao abrir configurações",
      "Status visual por camada: OK, ERRO, ATENÇÃO",
      "Botão manual para re-executar diagnóstico",
    ],
  },
  {
    version: "2.9.1",
    date: "2026-02-12",
    title: "Configurações Globais de Notificações",
    type: "feature",
    description: "Admins podem ativar/desativar tipos de notificação (leads, orçamentos, WhatsApp, alertas) para toda a empresa.",
    details: [
      "Tabela notification_config com isolamento por tenant",
      "Configuração por tipo: novos leads, orçamentos, mensagens WhatsApp, leads parados, conversas esquecidas",
      "Edge Function send-push-notification consulta config antes de enviar",
      "Acessível em Administração → Sistema → Notificações",
    ],
  },
  {
    version: "2.9.0",
    date: "2026-02-12",
    title: "Sistema de Changelog Automático",
    type: "feature",
    description: "Área de histórico de atualizações visível para todos os usuários no painel administrativo e portal do vendedor.",
    details: [
      "Changelog com versionamento e categorização (feature, melhoria, correção, segurança, infra)",
      "Indicador visual de novas atualizações",
      "Acessível na seção Sistema do menu lateral",
    ],
  },
  {
    version: "2.8.1",
    date: "2026-02-12",
    title: "Hardening: Push Notifications",
    type: "security",
    description: "Remoção de policy duplicada em push_subscriptions e adição de tenant_id na tabela push_sent_log para rastreabilidade multi-tenant.",
    details: [
      "Policy SELECT duplicada removida de push_subscriptions",
      "Coluna tenant_id adicionada a push_sent_log com índice",
      "Edge Function send-push-notification propagando tenant_id",
    ],
  },
  {
    version: "2.8.0",
    date: "2026-02-11",
    title: "Arquitetura de Notificações Push",
    type: "feature",
    description: "Sistema completo de Web Push Notifications com VAPID, service worker e deep-linking para eventos críticos do CRM.",
    details: [
      "Push notifications para novos leads, orçamentos e mensagens WhatsApp",
      "Gestão de dispositivos e preferências (quiet hours)",
      "Supressão inteligente quando Inbox está ativo",
      "Anti-duplicidade com event_key determinístico",
      "Isolamento multi-tenant com permissões por role",
    ],
  },
  {
    version: "2.7.0",
    date: "2026-02-10",
    title: "Sincronização de Histórico WhatsApp",
    type: "feature",
    description: "Importação de conversas e mensagens da Evolution API com até 365 dias de histórico.",
    details: [
      "Sincronização automática ao conectar nova instância",
      "Botão manual com seleção de período",
      "Conversas importadas mantidas como resolvidas por padrão",
      "Reabertura automática se atividade nos últimos 7 dias",
    ],
  },
  {
    version: "2.6.0",
    date: "2026-02-09",
    title: "Google Calendar Integration",
    type: "feature",
    description: "Sincronização bidirecional de eventos do Google Calendar com o calendário do CRM.",
  },
  {
    version: "2.5.0",
    date: "2026-02-08",
    title: "Sistema de Planos e Limites",
    type: "feature",
    description: "Controle de uso por tenant com planos, limites de recursos e contadores de consumo.",
    details: [
      "Tabelas plans, plan_limits, subscriptions, usage_counters",
      "Funções check_tenant_limit e enforce_limit_or_throw",
      "Painel de gestão no Super Admin",
    ],
  },
  {
    version: "2.4.0",
    date: "2026-02-07",
    title: "Auditoria Imutável",
    type: "security",
    description: "Sistema de audit logs com triggers automáticos em 14 tabelas críticas, imutáveis por design.",
    details: [
      "Triggers de INSERT, UPDATE, DELETE com captura de dados",
      "Proteção contra modificação/exclusão de logs",
      "Visualização detalhada com diff de alterações",
    ],
  },
];
