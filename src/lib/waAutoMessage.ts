import { supabase } from "@/integrations/supabase/client";

// ─── Phone normalization (single source of truth) ─────────────────

/**
 * Strip all non-digits from a phone string.
 * Used everywhere: idempotency keys, assign RPC, logging.
 */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ─── Pipeline diagnostics (sessionStorage, per-lead) ──────────────

export interface WaPipelineDiag {
  leadId?: string;
  phone: string;
  sentAt?: string;
  sentOk?: boolean;
  sentError?: string;
  instanceUsed?: string;
  instanceSource?: string;
  assignAttempts: number;
  assignResult: "ok" | "not_found" | "permission_denied" | "error" | "pending";
  assignConvId?: string;
  assignError?: string;
}

const DIAG_KEY = "wa_pipeline_last";

export function savePipelineDiag(diag: WaPipelineDiag): void {
  try { sessionStorage.setItem(DIAG_KEY, JSON.stringify(diag)); } catch {}
}

export function loadPipelineDiag(): WaPipelineDiag | null {
  try {
    const raw = sessionStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Default welcome message template with placeholders.
 */
export const DEFAULT_AUTO_MESSAGE_TEMPLATE = `Olá, {nome}! 👋

Aqui é {consultor} da *Mais Energia Solar*. Recebemos sua solicitação de orçamento e já estamos preparando uma proposta personalizada para você!

📋 *Dados recebidos:*
{dados}

Em breve enviaremos sua proposta com os melhores equipamentos e condições de pagamento. Qualquer dúvida, estou à disposição! ☀️`;

// ─── Settings from vendedores.settings (jsonb) ─────────────────────

interface VendedorWaSettings {
  wa_auto_message_enabled?: boolean;
  wa_auto_message_template?: string;
}

/**
 * Get WA auto-message settings from vendedores.settings jsonb.
 * Falls back to defaults if not set.
 */
export async function getVendedorWaSettings(vendedorId: string): Promise<VendedorWaSettings> {
  try {
    const { data, error } = await supabase
      .from("vendedores")
      .select("settings")
      .eq("id", vendedorId)
      .maybeSingle();

    if (error || !data?.settings) {
      return { wa_auto_message_enabled: true, wa_auto_message_template: DEFAULT_AUTO_MESSAGE_TEMPLATE };
    }

    const settings = data.settings as Record<string, unknown>;
    return {
      wa_auto_message_enabled: settings.wa_auto_message_enabled !== false, // default: true
      wa_auto_message_template: (settings.wa_auto_message_template as string) || DEFAULT_AUTO_MESSAGE_TEMPLATE,
    };
  } catch {
    return { wa_auto_message_enabled: true, wa_auto_message_template: DEFAULT_AUTO_MESSAGE_TEMPLATE };
  }
}

/**
 * Save WA auto-message settings to vendedores.settings jsonb.
 * Merges with existing settings (does not overwrite other keys).
 */
export async function saveVendedorWaSettings(
  vendedorId: string,
  updates: Partial<VendedorWaSettings>
): Promise<boolean> {
  try {
    // Read current settings first to merge
    const { data: current } = await supabase
      .from("vendedores")
      .select("settings")
      .eq("id", vendedorId)
      .maybeSingle();

    const currentSettings = (current?.settings as Record<string, unknown>) || {};
    const merged = { ...currentSettings, ...updates };

    const { error } = await supabase
      .from("vendedores")
      .update({ settings: merged } as any)
      .eq("id", vendedorId);

    return !error;
  } catch {
    return false;
  }
}

// ─── Legacy localStorage helpers (kept for migration/fallback) ─────

const STORAGE_KEY = "wa_auto_msg_enabled";

export function isAutoMessageEnabled(userId: string): boolean {
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    const val = localStorage.getItem(key);
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

// ─── Message building ──────────────────────────────────────────────

/**
 * Build a welcome message from a template string with placeholders.
 */
export function buildAutoMessage(params: {
  nome: string;
  cidade?: string;
  estado?: string;
  consumo?: number;
  tipo_telhado?: string;
  consultor_nome?: string;
  template?: string;
}): string {
  const { nome, cidade, estado, consumo, tipo_telhado, consultor_nome, template } = params;
  
  const firstName = nome.split(" ")[0];
  const location = cidade && estado ? `${cidade}/${estado}` : cidade || estado || "";
  
  // Build dados section
  const dadosParts: string[] = [];
  if (location) dadosParts.push(`📍 Localização: ${location}`);
  if (consumo) dadosParts.push(`⚡ Consumo médio: ${consumo} kWh/mês`);
  if (tipo_telhado) dadosParts.push(`🏠 Tipo de telhado: ${tipo_telhado}`);
  const dadosStr = dadosParts.length > 0 ? dadosParts.join("\n") : "Dados em análise";

  // Use custom template or default
  const tpl = template || DEFAULT_AUTO_MESSAGE_TEMPLATE;
  
  return tpl
    .replace(/\{nome\}/g, firstName)
    .replace(/\{consultor\}/g, consultor_nome || "a equipe")
    .replace(/\{dados\}/g, dadosStr)
    .replace(/\{cidade\}/g, cidade || "")
    .replace(/\{estado\}/g, estado || "")
    .replace(/\{consumo\}/g, consumo ? `${consumo}` : "")
    .replace(/\{tipo_telhado\}/g, tipo_telhado || "");
}

// ─── Sending ───────────────────────────────────────────────────────

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
  
  // Idempotency check: prevent double-send per phone+lead combo
  const phoneDigits = normalizePhoneDigits(telefone);
  const idempotencyKey = leadId
    ? `wa_auto_msg_sent_${phoneDigits}_${leadId}`
    : `wa_auto_msg_sent_${phoneDigits}_${Date.now()}`;
  
  if (leadId && sessionStorage.getItem(idempotencyKey)) {
    console.log("[sendAutoWelcomeMessage] Already sent for this lead in this session, skipping");
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

    const result = response.data as { success?: boolean; instance_used?: string; instance_source?: string } | null;
    if (result?.success) {
      // Mark as sent in this session
      sessionStorage.setItem(idempotencyKey, Date.now().toString());
      console.log(`[sendAutoWelcomeMessage] Message sent successfully via instance=${result.instance_used || "?"} (${result.instance_source || "?"})`);
      // Store instance info for diagnostics
      try {
        const diag = loadPipelineDiag();
        if (diag) {
          diag.instanceUsed = result.instance_used || undefined;
          diag.instanceSource = result.instance_source || undefined;
          savePipelineDiag(diag);
        }
      } catch {}
      return true;
    }

    console.warn("[sendAutoWelcomeMessage] Send failed:", result);
    return false;
  } catch (err) {
    console.error("[sendAutoWelcomeMessage] Exception:", err);
    return false;
  }
}
