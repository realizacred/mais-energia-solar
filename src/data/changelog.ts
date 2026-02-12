/**
 * Changelog do Sistema — Fonte de verdade única.
 * Toda atualização significativa deve ser registrada aqui.
 * Formato: mais recente primeiro.
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
