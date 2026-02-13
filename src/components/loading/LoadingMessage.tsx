import { useState, useEffect, useMemo } from "react";

interface LoadingMessageProps {
  context?: string;
  catalog?: Record<string, string[]>;
  className?: string;
}

const DEFAULT_CATALOG: Record<string, string[]> = {
  general: ["Carregando..."],
  submit: ["Enviando dados...", "Processando..."],
  data_load: ["Carregando dados...", "Buscando informações..."],
  upload: ["Enviando arquivo...", "Processando upload..."],
  whatsapp: ["Enviando mensagem...", "Conectando..."],
  ai_analysis: ["Analisando dados...", "Processando análise..."],
  calculation: ["Calculando economia...", "Simulando cenários..."],
  login: ["Verificando credenciais...", "Autenticando..."],
};

export function getLoadingMessage(context: string = "general", catalog?: Record<string, string[]>): string {
  const cat = catalog || DEFAULT_CATALOG;
  const messages = cat[context] || cat.general || ["Carregando..."];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function LoadingMessage({ context = "general", catalog, className = "" }: LoadingMessageProps) {
  const message = useMemo(() => getLoadingMessage(context, catalog), [context, catalog]);

  return (
    <p className={`text-sm text-muted-foreground animate-fade-in ${className}`}>
      {message}
    </p>
  );
}

/** Rotating messages for long operations */
export function RotatingLoadingMessage({ 
  context = "general", 
  catalog,
  intervalMs = 3000,
  className = "" 
}: LoadingMessageProps & { intervalMs?: number }) {
  const cat = catalog || DEFAULT_CATALOG;
  const messages = cat[context] || cat.general || ["Carregando..."];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  return (
    <p className={`text-sm text-muted-foreground transition-opacity duration-300 ${className}`}>
      {messages[index]}
    </p>
  );
}
