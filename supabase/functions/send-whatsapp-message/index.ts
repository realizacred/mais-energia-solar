import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendMessageRequest {
  telefone: string;
  mensagem: string;
  lead_id?: string;
  tipo?: "automatico" | "manual" | "lembrete";
  instance_id?: string;
  tenant_id?: string; // callers MUST pass for service_role context
}

/**
 * AUTH MODEL: "auth required" — NOT a public webhook.
 * - Regular users: JWT validated via getClaims()
 * - Internal callers (automations): service_role key accepted, but tenant_id MUST be in body
 * 
 * INSTANCE ROUTING (priority order):
 * 1. body.instance_id (explicit — caller knows which instance)
 * 2. Vendor's linked instance via wa_instance_vendedores junction table
 * 3. config.evolution_instance (legacy fallback from whatsapp_automation_config)
 * 4. First active instance of the tenant
 * 
 * TENANT RESOLUTION (deterministic, no blind fallback):
 * 1. body.tenant_id (explicit — required for service_role)
 * 2. User profile (regular JWT)
 * 3. Lead record (if lead_id provided)
 * 4. FAIL — never uses wa_config as blind fallback
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ===== RATE LIMITING =====
    const identifier = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const supabaseRL = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await supabaseRL.rpc("check_rate_limit", {
      _function_name: "send-whatsapp-message",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 60,
    });
    if (allowed === false) {
      console.warn(`[send-wa] Rate limited: ${identifier}`);
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // ===== STAGING GUARD =====
    const isStaging = Deno.env.get("IS_STAGING") === "true";
    if (isStaging) {
      console.warn("[STAGING] WhatsApp send BLOCKED — ambiente de staging");
      return new Response(JSON.stringify({
        success: true,
        staging: true,
        message: "[STAGING] Mensagem NÃO enviada — ambiente de staging",
        results: [{ method: "staging-mock", success: true }],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTH ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const body = (await req.json().catch(() => null)) as SendMessageRequest | null;
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Body inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, mensagem, lead_id, tipo = "manual", instance_id } = body;

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TENANT RESOLUTION (deterministic — NO blind fallback) ──
    let tenantId: string | null = null;
    let tenantSource = "";

    // Strategy 1: Explicit tenant_id in body (REQUIRED for service_role callers)
    if (body.tenant_id) {
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", body.tenant_id)
        .eq("ativo", true)
        .maybeSingle();
      if (tenantRow) {
        tenantId = tenantRow.id;
        tenantSource = "body.tenant_id";
      } else {
        console.error(`[send-wa] BLOCKED: body.tenant_id=${body.tenant_id} not found or inactive`);
        return new Response(
          JSON.stringify({ success: false, error: "Tenant inválido ou inativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Strategy 2: From user profile (regular JWT user)
    if (!tenantId && userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.tenant_id) {
        tenantId = profile.tenant_id;
        tenantSource = "user_profile";
      }
    }

    // Strategy 3: From lead record (if lead_id provided)
    if (!tenantId && lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("tenant_id")
        .eq("id", lead_id)
        .maybeSingle();
      if (lead?.tenant_id) {
        tenantId = lead.tenant_id;
        tenantSource = "lead";
      }
    }

    if (!tenantId) {
      const reason = isServiceRole
        ? "service_role call sem tenant_id no body — obrigatório"
        : "Usuário sem tenant_id no profile";
      console.error(`[send-wa] BLOCKED: tenant não resolvido. Reason: ${reason}`);
      return new Response(
        JSON.stringify({ success: false, error: `Tenant não resolvido: ${reason}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-wa] tenant=${tenantId} via ${tenantSource}, userId=${userId || "service_role"}`);

    // ── FETCH CONFIG (scoped by resolved tenant) ──────────────
    const { data: config, error: configError } = await supabaseAdmin
      .from("whatsapp_automation_config")
      .select("ativo, modo_envio, webhook_url, api_token, evolution_api_url, evolution_api_key, evolution_instance")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (configError) {
      console.error("[send-wa] Config fetch error:", configError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao buscar configuração de WhatsApp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config) {
      console.warn(`[send-wa] No wa_config for tenant=${tenantId}`);
      return new Response(JSON.stringify({ success: false, error: "Configuração de WhatsApp não encontrada para este tenant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.ativo) {
      return new Response(JSON.stringify({ success: false, error: "Automação de WhatsApp está desativada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INSTANCE ROUTING (smart selection) ────────────────────
    // Priority:
    // 1. Explicit instance_id from request body
    // 2. Vendor's linked instance (via wa_instance_vendedores junction)
    // 3. config.evolution_instance (legacy)
    // 4. First active instance of tenant
    let resolvedInstance: { id: string; evolution_api_url: string; evolution_instance_key: string; api_key: string | null; status?: string } | null = null;
    let instanceSource = "";

    // Priority 1: Explicit instance_id
    if (instance_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instance_id);
      let q = supabaseAdmin.from("wa_instances").select("id, evolution_api_url, evolution_instance_key, api_key, status").eq("tenant_id", tenantId);
      if (isUuid) {
        q = q.eq("id", instance_id);
      } else {
        q = q.eq("evolution_instance_key", instance_id);
      }
      const { data: inst } = await q.maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "body.instance_id";
      }
    }

    // Priority 2: Vendor's linked instance via junction table
    // Works for both authenticated users (userId) and service_role calls (lead_id → vendedor_id)
    if (!resolvedInstance) {
      let vendedorId: string | null = null;

      // 2a: From authenticated user
      if (userId) {
        const { data: vendedor } = await supabaseAdmin
          .from("vendedores")
          .select("id")
          .eq("user_id", userId)
          .eq("ativo", true)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        vendedorId = vendedor?.id || null;
      }

      // 2b: From lead's vendedor_id (for service_role / public form calls)
      if (!vendedorId && lead_id) {
        const { data: leadVendedor } = await supabaseAdmin
          .from("leads")
          .select("vendedor_id")
          .eq("id", lead_id)
          .maybeSingle();
        vendedorId = leadVendedor?.vendedor_id || null;
      }

      if (vendedorId) {
        // Check junction table for linked instances
        const { data: links } = await supabaseAdmin
          .from("wa_instance_vendedores")
          .select("instance_id, wa_instances:instance_id(id, evolution_api_url, evolution_instance_key, api_key, status)")
          .eq("vendedor_id", vendedorId)
          .eq("tenant_id", tenantId);

        if (links && links.length > 0) {
          // Prefer connected instance, fallback to first
          const connected = links.find((l: any) => (l.wa_instances as any)?.status === "connected");
          const chosen = connected || links[0];
          const inst = (chosen as any).wa_instances;
          if (inst) {
            resolvedInstance = {
              id: inst.id,
              evolution_api_url: inst.evolution_api_url,
              evolution_instance_key: inst.evolution_instance_key,
              api_key: inst.api_key,
              status: inst.status,
            };
            instanceSource = "vendor_junction";
            console.log(`[send-wa] Routed to vendor's instance: ${inst.evolution_instance_key} (${connected ? "connected" : "first-link"}) vendedorId=${vendedorId}`);
          }
        }
      }
    }

    // Priority 3: Legacy config.evolution_instance
    if (!resolvedInstance && config.evolution_instance) {
      const { data: inst } = await supabaseAdmin
        .from("wa_instances")
        .select("id, evolution_api_url, evolution_instance_key, api_key, status")
        .eq("evolution_instance_key", config.evolution_instance)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "config.evolution_instance";
      }
    }

    // Priority 4: First active instance of tenant
    if (!resolvedInstance) {
      const { data: inst } = await supabaseAdmin
        .from("wa_instances")
        .select("id, evolution_api_url, evolution_instance_key, api_key, status")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "first_active_tenant_instance";
      }
    }

    console.log(`[send-wa] Instance resolved: ${resolvedInstance?.evolution_instance_key || "NONE"} (status=${resolvedInstance?.status || "?"}) via ${instanceSource}`);

    // ── INSTANCE HEALTH CHECK ─────────────────────────────────
    // If instance is resolved but not "connected", warn loudly.
    // We still ATTEMPT the send (Evolution may accept it), but log the risk.
    let instanceHealthWarning: string | null = null;
    if (resolvedInstance && resolvedInstance.status && resolvedInstance.status !== "connected") {
      instanceHealthWarning = `Instância "${resolvedInstance.evolution_instance_key}" com status "${resolvedInstance.status}" — pode falhar no envio. Verifique a conexão na Evolution API.`;
      console.warn(`[send-wa] ⚠️ HEALTH CHECK: ${instanceHealthWarning}`);
    }

    // ── SEND MESSAGE ──────────────────────────────────────────
    let formattedPhone = telefone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = `55${formattedPhone}`;
    }

    const results: Array<{ method: "webhook" | "evolution"; success: boolean; error?: string }> = [];
    const globalApiKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Webhook
    if ((config.modo_envio === "webhook" || config.modo_envio === "ambos") && config.webhook_url) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.api_token) headers["Authorization"] = `Bearer ${config.api_token}`;

        const webhookRes = await fetch(config.webhook_url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            telefone: formattedPhone,
            mensagem,
            lead_id,
            tipo,
            timestamp: new Date().toISOString(),
          }),
        });

        await webhookRes.text().catch(() => null);

        results.push({
          method: "webhook",
          success: webhookRes.ok,
          error: webhookRes.ok ? undefined : `Status: ${webhookRes.status}`,
        });
      } catch (e: any) {
        console.error("[send-wa] Webhook error:", e);
        results.push({ method: "webhook", success: false, error: e?.message || String(e) });
      }
    }

    // Evolution API
    if (config.modo_envio === "evolution" || config.modo_envio === "ambos") {
      if (resolvedInstance) {
        const evoApiUrl = resolvedInstance.evolution_api_url?.replace(/\/$/, "") || "";
        const evoInstance = resolvedInstance.evolution_instance_key;
        const evoApiKey = resolvedInstance.api_key || globalApiKey;

        if (evoApiUrl && evoInstance) {
          try {
            const sendUrl = `${evoApiUrl}/message/sendText/${encodeURIComponent(evoInstance)}`;
            console.log(`[send-wa] Sending to: ${sendUrl}`);

            const evoRes = await fetch(sendUrl, {
              method: "POST",
              headers: {
                apikey: evoApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                number: formattedPhone,
                text: mensagem,
              }),
            });

            const evoText = await evoRes.text();

            results.push({
              method: "evolution",
              success: evoRes.ok,
              error: evoRes.ok ? undefined : evoText || `Status: ${evoRes.status}`,
            });
          } catch (e: any) {
            console.error("[send-wa] Evolution error:", e);
            results.push({ method: "evolution", success: false, error: e?.message || String(e) });
          }
        } else {
          console.warn("[send-wa] Instance resolved but missing API URL or key");
          results.push({ method: "evolution", success: false, error: "Instância sem URL ou chave configurada" });
        }
      } else {
        // Legacy fallback to config fields (no wa_instances match)
        let evoApiUrl = "";
        let evoApiKey = globalApiKey;
        let evoInstance = "";

        if (config.evolution_api_url) {
          evoApiUrl = config.evolution_api_url.replace(/\/$/, "");
          evoInstance = config.evolution_instance || "";
          if (config.evolution_api_key) evoApiKey = config.evolution_api_key;
          console.log(`[send-wa] Legacy config fallback: instance=${evoInstance}`);
        }

        if (evoApiUrl && evoInstance) {
          try {
            const sendUrl = `${evoApiUrl}/message/sendText/${encodeURIComponent(evoInstance)}`;
            const evoRes = await fetch(sendUrl, {
              method: "POST",
              headers: { apikey: evoApiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ number: formattedPhone, text: mensagem }),
            });
            const evoText = await evoRes.text();
            results.push({
              method: "evolution",
              success: evoRes.ok,
              error: evoRes.ok ? undefined : evoText || `Status: ${evoRes.status}`,
            });
          } catch (e: any) {
            results.push({ method: "evolution", success: false, error: e?.message || String(e) });
          }
        } else {
          console.warn("[send-wa] Evolution API not configured");
          results.push({ method: "evolution", success: false, error: "Instância não configurada" });
        }
      }
    }

    const anySuccess = results.some((r) => r.success);
    const evolutionSuccess = results.some((r) => r.method === "evolution" && r.success);
    const status = anySuccess ? "enviado" : "erro";

    // ── SERVER-SIDE CONVERSATION CREATION (after Evolution ACK) ───
    // Only when Evolution send succeeded AND we have a resolved instance.
    // This guarantees the conversation + outbound message exist in wa_*
    // immediately — vendor sees it in Inbox without waiting for webhook.
    let createdConvId: string | null = null;
    let convCreatedOrUpdated = false;
    let messageSaved = false;
    let tagApplied = false;
    if (evolutionSuccess && resolvedInstance) {
      try {
        const remoteJid = `${formattedPhone}@s.whatsapp.net`;
        const messagePreview = mensagem.length > 100
          ? mensagem.substring(0, 100) + "…"
          : mensagem;

        // Resolve assigned_to: for automatic messages, ALWAYS use lead's vendedor (owner).
        // For manual messages, use the caller (consultant who sent it).
        let assignedTo: string | null = userId;
        let clienteNome: string | null = null;

        if (lead_id) {
          const { data: leadInfo } = await supabaseAdmin
            .from("leads")
            .select("nome, vendedor_id")
            .eq("id", lead_id)
            .maybeSingle();
          clienteNome = leadInfo?.nome || null;

          // For automatic messages OR when no caller userId: resolve from lead's vendedor
          if (leadInfo?.vendedor_id && (tipo === "automatico" || !assignedTo)) {
            const { data: vend } = await supabaseAdmin
              .from("vendedores")
              .select("user_id")
              .eq("id", leadInfo.vendedor_id)
              .maybeSingle();
            if (vend?.user_id) {
              if (tipo === "automatico" && assignedTo && assignedTo !== vend.user_id) {
                console.log(`[send-wa] Auto message: overriding caller ${assignedTo} with lead owner ${vend.user_id}`);
              }
              assignedTo = vend.user_id;
            }
          }
        }

        // Fetch profile picture (best-effort, non-blocking for message delivery)
        let profilePicUrl: string | null = null;
        try {
          profilePicUrl = await fetchProfilePicture(supabaseAdmin, resolvedInstance.id, remoteJid);
        } catch (_) { /* ignore */ }

        // Check if conversation already exists (avoid overwriting assigned_to)
        const { data: existingConv } = await supabaseAdmin
          .from("wa_conversations")
          .select("id, assigned_to, profile_picture_url")
          .eq("instance_id", resolvedInstance.id)
          .eq("remote_jid", remoteJid)
          .maybeSingle();

        if (existingConv) {
          // UPDATE: reopen, refresh preview, assign
          // For automatic lead messages, always ensure the conversation is assigned to the lead owner
          // (so it shows up in the consultant's Inbox even if it existed with a stale assigned_to).
          createdConvId = existingConv.id;
          const updates: Record<string, unknown> = {
            status: "open",
            last_message_at: new Date().toISOString(),
            last_message_preview: messagePreview,
            updated_at: new Date().toISOString(),
          };

          const shouldForceAssignToLeadOwner = tipo === "automatico" && !!lead_id && !!assignedTo;
          if (shouldForceAssignToLeadOwner) {
            if (existingConv.assigned_to !== assignedTo) {
              updates.assigned_to = assignedTo;
              console.log(
                `[send-wa] Reassigned conversation ${existingConv.id} from ${existingConv.assigned_to || "(null)"} to ${assignedTo} (auto lead message)`
              );
            }
          } else if (!existingConv.assigned_to && assignedTo) {
            updates.assigned_to = assignedTo;
          }

          if (lead_id) updates.lead_id = lead_id;
          if (clienteNome) updates.cliente_nome = clienteNome;
          if (profilePicUrl && profilePicUrl !== existingConv.profile_picture_url) {
            updates.profile_picture_url = profilePicUrl;
          }

          await supabaseAdmin.from("wa_conversations").update(updates).eq("id", existingConv.id);
          console.log(`[send-wa] Conversation updated (existing): ${existingConv.id}`);
          convCreatedOrUpdated = true;
        } else {
          // INSERT new conversation
          const { data: newConv, error: convErr } = await supabaseAdmin
            .from("wa_conversations")
            .insert({
              tenant_id: tenantId,
              instance_id: resolvedInstance.id,
              remote_jid: remoteJid,
              cliente_telefone: formattedPhone,
              cliente_nome: clienteNome,
              assigned_to: assignedTo,
              lead_id: lead_id || null,
              status: "open",
              last_message_at: new Date().toISOString(),
              last_message_preview: messagePreview,
              is_group: false,
              canal: "whatsapp",
              profile_picture_url: profilePicUrl,
            })
            .select("id")
            .single();

          if (convErr) {
            console.error("[send-wa] Conv insert failed:", convErr);
          } else {
            createdConvId = newConv!.id;
            convCreatedOrUpdated = true;
            console.log(`[send-wa] Conversation created: ${createdConvId}`);
          }
        }

        // Insert outbound message in wa_messages
        if (createdConvId) {
          const { error: msgErr } = await supabaseAdmin
            .from("wa_messages")
            .insert({
              tenant_id: tenantId,
              conversation_id: createdConvId,
              direction: "out",
              message_type: "text",
              content: mensagem,
              sent_by_user_id: assignedTo,
              status: "sent",
            });
          if (msgErr) {
            console.error("[send-wa] Message insert failed:", msgErr);
          } else {
            messageSaved = true;
          }
        }

        // Auto-tag "Aguardando orçamento" (only for automatic sends)
        if (createdConvId && tipo === "automatico") {
          try {
            const { data: existingTag } = await supabaseAdmin
              .from("wa_tags")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("name", "Aguardando orçamento")
              .maybeSingle();

            let tagId = existingTag?.id;
            if (!tagId) {
              const { data: newTag } = await supabaseAdmin
                .from("wa_tags")
                .insert({ tenant_id: tenantId, name: "Aguardando orçamento", color: "#f59e0b" })
                .select("id")
                .single();
              tagId = newTag?.id;
            }

            if (tagId) {
              await supabaseAdmin
                .from("wa_conversation_tags")
                .upsert(
                  { conversation_id: createdConvId, tag_id: tagId },
                  { onConflict: "conversation_id,tag_id" }
                );
              console.log(`[send-wa] Tag "Aguardando orçamento" applied to conv ${createdConvId}`);
              tagApplied = true;
            }
          } catch (tagErr) {
            console.warn("[send-wa] Tag assignment failed (non-blocking):", tagErr);
          }
        }
      } catch (convErr) {
        console.warn("[send-wa] Conversation creation failed (non-blocking):", convErr);
      }
    }

    // ── LOG (explicit tenant_id + instance_id) ────────────────
    const logErroDetalhes = anySuccess
      ? (instanceHealthWarning ? JSON.stringify({ warning: instanceHealthWarning }) : null)
      : JSON.stringify(results);
    const { error: logError } = await supabaseAdmin.from("whatsapp_automation_logs").insert({
      lead_id: lead_id || null,
      telefone: formattedPhone,
      mensagem_enviada: mensagem,
      status,
      erro_detalhes: logErroDetalhes,
      tenant_id: tenantId,
      instance_id: resolvedInstance?.id || null,
    });

    if (logError) console.warn("[send-wa] Log insert failed (non-blocking):", logError);

    if (results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum método de envio configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-wa] Done tenant=${tenantId} src=${tenantSource} instance=${resolvedInstance?.evolution_instance_key || "NONE"} via=${instanceSource}: ${results.length} methods, anySuccess=${anySuccess}`);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
        instance_used: resolvedInstance?.evolution_instance_key || null,
        instance_source: instanceSource,
        instance_status: resolvedInstance?.status || null,
        instance_health_warning: instanceHealthWarning,
        conversation_id: createdConvId,
        created_or_updated: convCreatedOrUpdated,
        message_saved: messageSaved,
        tag_applied: tagApplied,
        message: anySuccess ? "Mensagem enviada com sucesso" : "Falha ao enviar mensagem",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-wa] Unhandled error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Fetch profile picture from Evolution API ──
async function fetchProfilePicture(
  supabase: any,
  instanceId: string,
  remoteJid: string,
): Promise<string | null> {
  try {
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instanceId)
      .maybeSingle();

    if (!instance) return null;

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) return null;

    const endpoint = `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceKey)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: remoteJid }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const picUrl = data?.profilePictureUrl || data?.data?.profilePictureUrl || data?.url || data?.profilePicUrl || null;
    if (picUrl) {
      console.log(`[send-wa] Profile picture fetched for ${remoteJid}`);
    }
    return picUrl;
  } catch (err) {
    console.warn("[send-wa] Failed to fetch profile picture:", err);
    return null;
  }
}
