/**
 * SSOT service: WhatsApp → Contacts upsert + optional Google push.
 *
 * This service is the single entry point for creating/updating contacts
 * from WhatsApp interactions. It handles:
 * 1. Contact upsert via the canonical RPC (which also upserts contact_identities)
 * 2. Optional async push to Google Contacts if integration is active
 * 3. Audit logging for all operations
 */

import { supabase } from "@/integrations/supabase/client";

const EDGE_FN = "google-contacts-integration";

interface UpsertResult {
  contactId: string | null;
  conversationId: string | null;
  reused: boolean;
  googlePushTriggered: boolean;
}

/**
 * Upsert a contact from WhatsApp context.
 * The actual upsert logic lives in the DB RPC (rpc_recall_or_start_conversation)
 * which sets source='whatsapp', roles=['cliente'], and upserts contact_identities.
 *
 * This function additionally triggers a Google push if enabled.
 */
export async function upsertContactFromWhatsApp(params: {
  phoneRaw: string;
  displayName?: string;
  instancePreference?: string;
  message?: string;
}): Promise<UpsertResult> {
  const rpcParams: Record<string, unknown> = {
    p_phone_raw: params.phoneRaw,
  };
  if (params.displayName?.trim()) rpcParams.p_name_optional = params.displayName.trim();
  if (params.message?.trim()) rpcParams.p_message_optional = params.message.trim();
  if (params.instancePreference) rpcParams.p_instance_preference = params.instancePreference;

  const { data, error } = await (supabase.rpc as any)(
    "rpc_recall_or_start_conversation",
    rpcParams,
  );

  if (error) throw error;

  const result = data as {
    conversation_id: string;
    contact_id: string;
    reused: boolean;
  };

  // Try async Google push (fire-and-forget, never blocks)
  let googlePushTriggered = false;
  if (result.contact_id) {
    googlePushTriggered = await tryGooglePush(result.contact_id);
  }

  return {
    contactId: result.contact_id,
    conversationId: result.conversation_id,
    reused: result.reused,
    googlePushTriggered,
  };
}

/**
 * Update contact roles (multi-select: cliente, fornecedor, funcionario, outro).
 */
export async function updateContactRoles(contactId: string, roles: string[]): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({ roles, updated_at: new Date().toISOString() } as any)
    .eq("id", contactId);
  if (error) throw error;

  // Async Google push
  await tryGooglePush(contactId);
}

/**
 * Update contact display info (name, email) and optionally push to Google.
 */
export async function updateContactInfo(
  contactId: string,
  data: { displayName?: string; email?: string; roles?: string[] },
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.displayName !== undefined) {
    updates.display_name = data.displayName;
    updates.name = data.displayName;
  }
  if (data.email !== undefined) {
    updates.emails = data.email ? [{ value: data.email, label: "other", is_primary: true }] : [];
  }
  if (data.roles !== undefined) {
    updates.roles = data.roles;
  }

  const { error } = await supabase
    .from("contacts")
    .update(updates as any)
    .eq("id", contactId);
  if (error) throw error;

  // Async Google push
  await tryGooglePush(contactId);
}

/**
 * Fire-and-forget Google push. Returns true if triggered, false if skipped.
 * Never throws — logs errors silently.
 */
async function tryGooglePush(contactId: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${EDGE_FN}?action=push-upsert`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ contact_id: contactId }),
    });

    const json = await res.json();
    // push-upsert returns { skipped: true } when push_on_save is off or not connected
    return json.success === true;
  } catch {
    // Never block the caller
    return false;
  }
}
