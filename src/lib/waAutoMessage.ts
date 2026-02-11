import { supabase } from "@/integrations/supabase/client";

// ─── Phone normalization (single source of truth) ─────────────────

/**
 * Normalize a Brazilian phone number to a consistent digit-only format.
 * 
 * Rules:
 * - Strip all non-digits
 * - Remove country code 55 prefix if present
 * - For 10-digit numbers (DDD + 8 digits landline): keep as-is
 * - For 11-digit numbers (DDD + 9 + 8 digits mobile): keep as-is
 * - For 12-digit numbers starting with DDD (missing the 9): insert 9 after DDD
 * 
 * Output: always DDD + number (10 or 11 digits), no country code.
 * This prevents duplicate conversations from 12 vs 13 digit formats.
 */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Remove country code 55 if present (13 or 12 digits starting with 55)
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.substring(2);
  }

  // Now we should have 10 or 11 digits (DDD + number)
  // If 10 digits and 3rd digit is NOT 9, it's a landline — keep as-is
  // If 10 digits and starts with mobile pattern, insert 9 after DDD
  if (digits.length === 10) {
    const afterDDD = digits.substring(2);
    // Mobile numbers in BR always start with 9 after DDD
    // If 8 digits after DDD and first is 6-9, it's likely mobile missing the 9
    if (/^[6-9]/.test(afterDDD)) {
      digits = digits.substring(0, 2) + "9" + afterDDD;
    }
  }

  return digits;
}

/**
 * Build a full international remote_jid from normalized digits.
 * Always produces: 55{normalizedDigits}@s.whatsapp.net
 */
export function buildRemoteJid(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  return `55${digits}@s.whatsapp.net`;
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
      wa_auto_message_enabled: settings.wa_auto_message_enabled !== false,
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

// ─── Cooldown-based idempotency ────────────────────────────────────

const COOLDOWN_LEAD_MS = 2_000;   // 2s cooldown per leadId (anti-double-click only)
const COOLDOWN_PHONE_MS = 2_000;  // 2s cooldown per phone (anti-double-click only)

interface CooldownEntry {
  ts: number;
}

function getCooldownKey(leadId?: string, phoneDigits?: string): string {
  if (leadId) return `wa_cooldown_lead_${leadId}`;
  return `wa_cooldown_phone_${phoneDigits || "unknown"}`;
}

function isCooldownActive(key: string, maxMs: number): boolean {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return false;
    const entry: CooldownEntry = JSON.parse(raw);
    return (Date.now() - entry.ts) < maxMs;
  } catch {
    return false;
  }
}

function setCooldown(key: string): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now() }));
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
  
  const dadosParts: string[] = [];
  if (location) dadosParts.push(`📍 Localização: ${location}`);
  if (consumo) dadosParts.push(`⚡ Consumo médio: ${consumo} kWh/mês`);
  if (tipo_telhado) dadosParts.push(`🏠 Tipo de telhado: ${tipo_telhado}`);
  const dadosStr = dadosParts.length > 0 ? dadosParts.join("\n") : "Dados em análise";

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
 * - Cooldown-based idempotency (30s per lead, 10s per phone)
 * - forceResend=true bypasses cooldown (for manual resend button)
 * - Respects multi-instance: uses conversation's instance (never changes it)
 * - Rate limited on edge function side
 */
export async function sendAutoWelcomeMessage(params: {
  telefone: string;
  leadId?: string;
  mensagem: string;
  userId: string;
  forceResend?: boolean;
}): Promise<{ sent: boolean; blocked?: "cooldown"; reason?: string; conversation_id?: string; message_saved?: boolean; tag_applied?: boolean }> {
  const { telefone, leadId, mensagem, userId, forceResend } = params;
  
  const phoneDigits = normalizePhoneDigits(telefone);
  
  // Cooldown check (unless forced)
  if (!forceResend) {
    const cooldownKey = getCooldownKey(leadId, phoneDigits);
    const cooldownMs = leadId ? COOLDOWN_LEAD_MS : COOLDOWN_PHONE_MS;
    
    if (isCooldownActive(cooldownKey, cooldownMs)) {
      const reason = leadId
        ? `Cooldown ativo para leadId=${leadId} (anti-duplo clique, ${COOLDOWN_LEAD_MS / 1000}s)`
        : `Cooldown ativo para phone=${phoneDigits} (${COOLDOWN_PHONE_MS / 1000}s)`;
      console.warn(`[sendAutoWelcomeMessage] BLOQUEADO: ${reason}`);
      return { sent: false, blocked: "cooldown", reason };
    }
  }
  
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      console.warn("[sendAutoWelcomeMessage] No auth session");
      return { sent: false, reason: "No auth session" };
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
      return { sent: false, reason: String(response.error) };
    }

    const result = response.data as {
      success?: boolean;
      instance_used?: string;
      instance_source?: string;
      conversation_id?: string;
      created_or_updated?: boolean;
      message_saved?: boolean;
      tag_applied?: boolean;
    } | null;
    if (result?.success) {
      // Set cooldown
      const cooldownKey = getCooldownKey(leadId, phoneDigits);
      setCooldown(cooldownKey);
      
      console.log(`[sendAutoWelcomeMessage] ✅ Enviado via instance=${result.instance_used || "?"} (${result.instance_source || "?"}) conv=${result.conversation_id || "?"}`);
      
      // Store instance info for diagnostics
      try {
        const diag = loadPipelineDiag();
        if (diag) {
          diag.instanceUsed = result.instance_used || undefined;
          diag.instanceSource = result.instance_source || undefined;
          diag.assignConvId = result.conversation_id || undefined;
          diag.assignResult = result.conversation_id ? "ok" : "pending";
          savePipelineDiag(diag);
        }
      } catch {}
      return {
        sent: true,
        conversation_id: result.conversation_id || undefined,
        message_saved: result.message_saved || false,
        tag_applied: result.tag_applied || false,
      };
    }

    console.warn("[sendAutoWelcomeMessage] Send failed:", result);
    return { sent: false, reason: "API returned success=false" };
  } catch (err) {
    console.error("[sendAutoWelcomeMessage] Exception:", err);
    return { sent: false, reason: String(err) };
  }
}
