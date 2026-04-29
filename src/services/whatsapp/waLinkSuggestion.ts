import { supabase } from "@/integrations/supabase/client";

export interface SuggestionRow {
  id: string;
  conversation_id: string;
  suggested_entity_type: "cliente" | "lead" | null;
  suggested_entity_id: string | null;
  confidence: number | null;
  reason: string | null;
  evidence: any;
  status: "pending" | "accepted" | "rejected" | "expired";
}

export async function generateLinkSuggestion(conversationId: string) {
  const { data, error } = await supabase.functions.invoke("wa-ai-suggest-link", {
    body: { conversation_id: conversationId },
  });
  if (error) throw error;
  return data;
}

export async function acceptSuggestion(suggestion: SuggestionRow) {
  if (!suggestion.suggested_entity_id || !suggestion.suggested_entity_type) {
    throw new Error("Sugestão inválida");
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // Atualiza conversa (RLS garante tenant)
  const updates: any = {};
  if (suggestion.suggested_entity_type === "cliente") {
    updates.cliente_id = suggestion.suggested_entity_id;
  } else {
    updates.lead_id = suggestion.suggested_entity_id;
  }
  const { error: updErr } = await supabase
    .from("wa_conversations")
    .update(updates)
    .eq("id", suggestion.conversation_id);
  if (updErr) throw updErr;

  // Marca sugestão aceita
  await supabase
    .from("wa_conversation_resolution_suggestions")
    .update({
      status: "accepted",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestion.id);

  // Log de auditoria
  const { data: conv } = await supabase
    .from("wa_conversations")
    .select("tenant_id")
    .eq("id", suggestion.conversation_id)
    .maybeSingle();
  if (conv) {
    await supabase.from("wa_conversation_resolution_logs").insert({
      tenant_id: conv.tenant_id,
      conversation_id: suggestion.conversation_id,
      status: "resolved",
      matched_entity_type: suggestion.suggested_entity_type,
      matched_entity_id: suggestion.suggested_entity_id,
      reason: `Aceita sugestão IA (confidence=${suggestion.confidence ?? "?"})`,
      resolved_by: user.id,
    });
  }
}

export async function rejectSuggestion(suggestionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from("wa_conversation_resolution_suggestions")
    .update({
      status: "rejected",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);
}
