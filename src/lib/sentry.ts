import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

/**
 * Inicializa o Sentry para captura de erros e performance.
 * O DSN é uma chave pública — seguro para client-side.
 * 
 * Para ativar, defina VITE_SENTRY_DSN no .env
 * ou substitua diretamente acima.
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.info("[Sentry] DSN não configurado — error tracking desativado.");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance — amostragem de 20% em produção
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,

    // Session Replay — 10% sessões normais, 100% com erro
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Environment
    environment: import.meta.env.PROD ? "production" : "development",
    
    // Filtrar erros irrelevantes
    beforeSend(event) {
      // Ignorar erros de extensões do browser
      if (event.exception?.values?.some(v => 
        v.stacktrace?.frames?.some(f => 
          f.filename?.includes("chrome-extension://") ||
          f.filename?.includes("moz-extension://")
        )
      )) {
        return null;
      }
      return event;
    },

    // Dados sensíveis — não enviar PII
    sendDefaultPii: false,
  });

  console.info("[Sentry] Error tracking inicializado.");
}

/**
 * Captura um erro manualmente com contexto extra.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Define o usuário atual no Sentry para rastreamento.
 */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null) {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, role: user.role });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Adiciona breadcrumb para contexto de navegação.
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

// Re-exportar ErrorBoundary do Sentry para uso em componentes
export const SentryErrorBoundary = Sentry.ErrorBoundary;
