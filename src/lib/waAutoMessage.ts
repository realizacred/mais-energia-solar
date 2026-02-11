import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "wa_auto_msg_enabled";

/**
 * Check if auto-message is enabled for the current user.
 * Uses localStorage per user to avoid needing a DB column.
 */
export function isAutoMessageEnabled(userId: string): boolean {
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    const val = localStorage.getItem(key);
    // Default: enabled (opt-out model)
    return val !== "false";
  } catch {
    return true;
  }
}

export function setAutoMessageEnabled(userId: string, enabled: boolean): void {
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    localStorage.setItem(key, enabled ? "true" : "false");
  } catch {}
}

/**
 * Build a professional welcome message based on lead data.
 */
export function buildAutoMessage(params: {
  nome: string;
  cidade?: string;
  estado?: string;
  consumo?: number;
  tipo_telhado?: string;
  consultor_nome?: string;
}): string {
  const { nome, cidade, estado, consumo, tipo_telhado, consultor_nome } = params;
  
  const firstName = nome.split(" ")[0];
  const location = cidade && estado ? `${cidade}/${estado}` : cidade || estado || "";
  
  let msg = `Olá, ${firstName}! 👋\n\n`;
  msg += `Aqui é ${consultor_nome || "a equipe"} da *Mais Energia Solar*. `;
  msg += `Recebemos sua solicitação de orçamento e já estamos preparando uma proposta personalizada para você!\n\n`;
  
  msg += `📋 *Dados recebidos:*\n`;
  if (location) msg += `📍 Localização: ${location}\n`;
  if (consumo) msg += `⚡ Consumo médio: ${consumo} kWh/mês\n`;
  if (tipo_telhado) msg += `🏠 Tipo de telhado: ${tipo_telhado}\n`;
  
  msg += `\nEm breve enviaremos sua proposta com os melhores equipamentos e condições de pagamento. `;
  msg += `Qualquer dúvida, estou à disposição! ☀️`;
  
  return msg;
}

/**
 * Send the auto-message via the send-whatsapp-message edge function.
 * Returns true if sent successfully, false otherwise.
 * 
 * Guardrails:
 * - Idempotency via sessionStorage (prevents double-send in same session)
 * - Respects multi-instance: uses conversation's instance (never changes it)
 * - Rate limited on edge function side
 */
export async function sendAutoWelcomeMessage(params: {
  telefone: string;
  leadId?: string;
  mensagem: string;
  userId: string;
}): Promise<boolean> {
  const { telefone, leadId, mensagem, userId } = params;
  
  // Idempotency check: prevent double-send in same session
  const idempotencyKey = `wa_auto_msg_sent_${telefone.replace(/\D/g, "")}`;
  if (sessionStorage.getItem(idempotencyKey)) {
    console.log("[sendAutoWelcomeMessage] Already sent in this session, skipping");
    return false;
  }
  
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.warn("[sendAutoWelcomeMessage] No auth session");
      return false;
    }

    const response = await supabase.functions.invoke("send-whatsapp-message", {
      body: {
        telefone,
        mensagem,
        lead_id: leadId,
        tipo: "automatico" as const,
      },
    });

    if (response.error) {
      console.error("[sendAutoWelcomeMessage] Edge function error:", response.error);
      return false;
    }

    const result = response.data as { success?: boolean } | null;
    if (result?.success) {
      // Mark as sent in this session
      sessionStorage.setItem(idempotencyKey, Date.now().toString());
      console.log("[sendAutoWelcomeMessage] Message sent successfully");
      return true;
    }

    console.warn("[sendAutoWelcomeMessage] Send failed:", result);
    return false;
  } catch (err) {
    console.error("[sendAutoWelcomeMessage] Exception:", err);
    return false;
  }
}
