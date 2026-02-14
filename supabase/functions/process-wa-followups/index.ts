import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAX_AI = 5, AI_TIMEOUT = 5000, MAX_INST = 5;
const ALARM = { total: 45000, rpc: 2000, reconcile: 3000, ai: 25000, timeouts: 2, pendente: 50, revisao: 20 };

type M = { skipped_lock: boolean; claimed_count: number; filtered_scenario: number; created_count: number; sent_count: number; ai_approved: number; ai_timeouts: number; pending_review: number; errors: number; reconciled: number; conflicts_23505: number; instance_rate_limited: number; ai_budget_exhausted: number; timing: { total_ms: number; reconcile_ms: number; rpc_ms: number; insert_ms: number; ai_total_ms: number; send_ms: number }; backlog: { pendente: number; pendente_revisao: number }; alarms: { total_ms_high: boolean; rpc_ms_high: boolean; reconcile_ms_high: boolean; ai_total_ms_high: boolean; ai_timeouts_high: boolean; backlog_pendente_high: boolean; backlog_pendente_revisao_high: boolean; skipped_lock_streak: number } };

const mk = (): M => ({ skipped_lock: false, claimed_count: 0, filtered_scenario: 0, created_count: 0, sent_count: 0, ai_approved: 0, ai_timeouts: 0, pending_review: 0, errors: 0, reconciled: 0, conflicts_23505: 0, instance_rate_limited: 0, ai_budget_exhausted: 0, timing: { total_ms: 0, reconcile_ms: 0, rpc_ms: 0, insert_ms: 0, ai_total_ms: 0, send_ms: 0 }, backlog: { pendente: 0, pendente_revisao: 0 }, alarms: { total_ms_high: false, rpc_ms_high: false, reconcile_ms_high: false, ai_total_ms_high: false, ai_timeouts_high: false, backlog_pendente_high: false, backlog_pendente_revisao_high: false, skipped_lock_streak: 0 } });

function evalAlarms(m: M) {
  m.alarms.total_ms_high = m.timing.total_ms > ALARM.total;
  m.alarms.rpc_ms_high = m.timing.rpc_ms > ALARM.rpc;
  m.alarms.reconcile_ms_high = m.timing.reconcile_ms > ALARM.reconcile;
  m.alarms.ai_total_ms_high = m.timing.ai_total_ms > ALARM.ai;
  m.alarms.ai_timeouts_high = m.ai_timeouts >= ALARM.timeouts;
  m.alarms.backlog_pendente_high = m.backlog.pendente > ALARM.pendente;
  m.alarms.backlog_pendente_revisao_high = m.backlog.pendente_revisao > ALARM.revisao;
}

const json = (body: Record<string, unknown>, s = 200) => new Response(JSON.stringify(body), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now(), m = mk();
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: locked, error: le } = await sb.rpc("try_followup_lock");
    if (le || !locked) {
      m.skipped_lock = true;
      const { count } = await sb.from("wa_followup_queue").select("id", { count: "exact", head: true }).eq("status", "pendente");
      m.backlog.pendente = count ?? 0;
      m.alarms.skipped_lock_streak = 1;
      m.timing.total_ms = Date.now() - t0;
      evalAlarms(m);
      console.log("[followup] SKIP lock_busy", JSON.stringify(m));
      return json({ ...m, success: true });
    }
    try {
      const [{ count: cp }, { count: cr }] = await Promise.all([
        sb.from("wa_followup_queue").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        sb.from("wa_followup_queue").select("id", { count: "exact", head: true }).eq("status", "pendente_revisao"),
      ]);
      m.backlog.pendente = cp ?? 0;
      m.backlog.pendente_revisao = cr ?? 0;

      let t = Date.now();
      m.reconciled = await reconcile(sb);
      m.timing.reconcile_ms = Date.now() - t;

      t = Date.now();
      const { data: cands, error: ce } = await sb.rpc("claim_followup_candidates", { _limit: 200 });
      m.timing.rpc_ms = Date.now() - t;
      if (ce) throw ce;
      if (!cands?.length) { m.timing.total_ms = Date.now() - t0; evalAlarms(m); console.log("[followup] OK no_candidates", JSON.stringify(m)); return json({ ...m, success: true }); }
      m.claimed_count = cands.length;

      const eligible = cands.filter((c: any) => {
        if (c.cenario === "equipe_sem_resposta" && c.last_msg_direction !== "in") { m.filtered_scenario++; return false; }
        if (c.cenario === "cliente_sem_resposta" && c.last_msg_direction !== "out") { m.filtered_scenario++; return false; }
        return true;
      });

      const noOwner = eligible.filter((c: any) => !c.assigned_to);
      if (noOwner.length) {
        const iids = [...new Set(noOwner.map((c: any) => c.instance_id).filter(Boolean))];
        if (iids.length) {
          const om = await resolveOwners(sb, iids);
          for (const c of noOwner) if (!c.assigned_to && c.instance_id) c.assigned_to = om.get(c.instance_id) || null;
        }
      }

      // G3: Filter out candidates from inactive tenants
      const tids = [...new Set(eligible.map((c: any) => c.tenant_id))];
      const { data: activeTenants } = await sb.from("tenants").select("id").in("id", tids).eq("status", "active").is("deleted_at", null);
      const activeSet = new Set((activeTenants || []).map((t: any) => t.id));
      const tenantFiltered = eligible.filter((c: any) => activeSet.has(c.tenant_id));
      
      const aiMap = await loadAi(sb, [...activeSet]);
      const after = tenantFiltered.filter((c: any) => aiMap.get(c.tenant_id)?.modo !== "desativado");

      const ins = after.map((c: any) => ({ tenant_id: c.tenant_id, rule_id: c.rule_id, conversation_id: c.conversation_id, status: "pendente", tentativa: Number(c.attempt_count) + 1, scheduled_at: new Date().toISOString(), assigned_to: c.assigned_to }));
      if (ins.length) {
        t = Date.now();
        const { error: ie } = await sb.from("wa_followup_queue").insert(ins).select("id");
        m.timing.insert_ms = Date.now() - t;
        if (ie) { if (ie.code === "23505") { m.conflicts_23505++; } else throw ie; }
        m.created_count = ins.length;
      }

      const auto = after.filter((c: any) => c.envio_automatico && c.mensagem_template);
      const isc = new Map<string, number>();
      let aiN = 0, tAi = Date.now(), sendAcc = 0;
      for (const c of auto) {
        const ic = isc.get(c.instance_id) || 0;
        if (ic >= MAX_INST) { m.instance_rate_limited++; continue; }
        const s = aiMap.get(c.tenant_id);
        const base = (c.mensagem_template as string).replace(/\{nome\}/g, c.cliente_nome || "").replace(/\{vendedor\}/g, "").replace(/\{consultor\}/g, "");
        let final = base;
        if (s?.modo !== "desativado" && aiN < MAX_AI) {
          aiN++;
          const g = await aiGate(sb, c, base, s);
          if (g.timeout) { m.ai_timeouts++; m.pending_review++; await updFU(sb, c.conversation_id, c.rule_id, "pendente_revisao", `[IA timeout] ${base}`); continue; }
          const th = s?.followup_confidence_threshold ?? 60;
          if (g.confidence < th) { m.pending_review++; await updFU(sb, c.conversation_id, c.rule_id, "pendente_revisao", `[IA: ${g.reason}] ${g.adj || base}`); continue; }
          m.ai_approved++;
          if (g.adj) final = g.adj;
        } else if (s?.modo !== "desativado" && aiN >= MAX_AI) { m.ai_budget_exhausted++; continue; }

        const ts = Date.now();
        try {
          const { data: msg } = await sb.from("wa_messages").insert({ conversation_id: c.conversation_id, direction: "out", message_type: "text", content: final, is_internal_note: false, status: "pending", tenant_id: c.tenant_id, source: "followup" }).select("id").single();
          if (msg && c.remote_jid && c.instance_id) {
            await sb.from("wa_outbox").insert({ instance_id: c.instance_id, conversation_id: c.conversation_id, message_id: msg.id, remote_jid: c.remote_jid, message_type: "text", content: final, status: "pending", tenant_id: c.tenant_id });
            await updFU(sb, c.conversation_id, c.rule_id, "enviado", final);
            isc.set(c.instance_id, ic + 1);
            m.sent_count++;
          }
        } catch (e: any) { m.errors++; console.error(`[followup] SEND_ERROR conv=${c.conversation_id}`, e.message); await updFU(sb, c.conversation_id, c.rule_id, "falhou", `[erro] ${e.message}`); }
        sendAcc += Date.now() - ts;
      }
      m.timing.ai_total_ms = Date.now() - tAi - sendAcc;
      m.timing.send_ms = sendAcc;
      if (m.sent_count > 0) { try { await sb.functions.invoke("process-wa-outbox"); } catch {} }
    } finally { try { await sb.rpc("release_followup_lock"); } catch {} }
    m.timing.total_ms = Date.now() - t0;
    evalAlarms(m);
    const alarm = Object.entries(m.alarms).some(([k, v]) => k !== "skipped_lock_streak" && v === true);
    if (alarm) console.warn("[followup] WARN", JSON.stringify(m)); else console.log("[followup] OK", JSON.stringify(m));
    return json({ ...m, success: true });
  } catch (e: any) {
    m.errors++; m.timing.total_ms = Date.now() - t0; evalAlarms(m);
    console.error("[followup] FATAL", e.message, JSON.stringify(m));
    try { const s2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); await s2.rpc("release_followup_lock"); } catch {}
    return json({ ...m, error: e.message }, 500);
  }
});

async function updFU(sb: any, cid: string, rid: string, status: string, msg?: string) {
  const u: any = { status };
  if (status === "enviado") u.sent_at = new Date().toISOString();
  if (msg) u.mensagem_enviada = msg;
  await sb.from("wa_followup_queue").update(u).eq("conversation_id", cid).eq("rule_id", rid).eq("status", "pendente");
}

async function resolveOwners(sb: any, ids: string[]) {
  const om = new Map<string, string>();
  const [{ data: inst }, { data: links }] = await Promise.all([
    sb.from("wa_instances").select("id, owner_user_id").in("id", ids),
    sb.from("wa_instance_consultores").select("instance_id, consultor_id, consultores:consultor_id(user_id)").in("instance_id", ids),
  ]);
  if (inst) for (const i of inst) {
    let uid = i.owner_user_id || null;
    if (!uid && links) { const l = links.find((x: any) => x.instance_id === i.id); uid = (l?.consultores as any)?.user_id || null; }
    if (uid) om.set(i.id, uid);
  }
  return om;
}

async function loadAi(sb: any, tids: string[]) {
  const map = new Map<string, any>();
  if (!tids.length) return map;
  const { data } = await sb.from("wa_ai_settings").select("tenant_id, modo, modelo_preferido, temperature, max_tokens, followup_cooldown_hours, followup_confidence_threshold").in("tenant_id", tids);
  const def = { modo: "assistido", followup_cooldown_hours: 4, followup_confidence_threshold: 60, modelo_preferido: "gpt-4o-mini", temperature: 0.5 };
  for (const t of tids) map.set(t, data?.find((s: any) => s.tenant_id === t) || def);
  return map;
}

type GR = { confidence: number; reason: string; adj?: string; timeout: boolean };

async function aiGate(sb: any, conv: any, proposed: string, ai: any): Promise<GR> {
  try {
    const { data: k } = await sb.from("integration_configs").select("api_key").eq("tenant_id", conv.tenant_id).eq("service_key", "openai").eq("is_active", true).single();
    if (!k?.api_key) return { confidence: 0, reason: "Sem chave OpenAI", timeout: false };
    const { data: msgs = [] } = await sb.from("wa_messages").select("direction, content, created_at, source").eq("conversation_id", conv.conversation_id).eq("is_internal_note", false).order("created_at", { ascending: false }).limit(10);
    const hist = msgs.reverse().map((m: any) => `[${m.direction === "in" ? "cli" : "cons"}${m.source !== "human" ? ` (${m.source})` : ""}]: ${m.content || "(mídia)"}`).join("\n");
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    const hrs = last ? Math.round((Date.now() - new Date(last.created_at).getTime()) / 3600000) : null;
    const sys = `Auditor de follow-up solar. Retorne JSON: {"confidence":0-100,"reason":"...","adjusted_message":"...ou null"}. BLOQUEIO(<30): cliente aguarda humano, encerrada, irritação. CAUTELA(30-70): ambíguo. APROVAÇÃO(>70): interesse ativo, timing ok.`;
    const usr = `Cliente: ${conv.cliente_nome || "?"} | Dir: ${conv.last_msg_direction} há ${hrs ?? "?"}h | Cenário: ${conv.cenario} | Tentativa: ${conv.attempt_count + 1}/${conv.max_tentativas}\nHIST:\n${hist || "(vazio)"}\nPROPOSTA:\n${proposed}`;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), AI_TIMEOUT);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${k.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: ai?.modelo_preferido || "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 300, temperature: ai?.temperature ?? 0.3 }),
        signal: ac.signal,
      });
      clearTimeout(to);
      if (!r.ok) return { confidence: 0, reason: `HTTP ${r.status}`, timeout: false };
      const d = await r.json();
      const raw = d.choices?.[0]?.message?.content?.trim();
      if (!raw) return { confidence: 0, reason: "Resposta vazia", timeout: false };
      const p = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      return { confidence: Math.min(100, Math.max(0, p.confidence || 0)), reason: p.reason || "?", adj: p.adjusted_message || undefined, timeout: false };
    } catch (e: any) { clearTimeout(to); return e.name === "AbortError" ? { confidence: 0, reason: "Timeout IA", timeout: true } : { confidence: 0, reason: e.message, timeout: false }; }
  } catch (e: any) { return { confidence: 0, reason: e.message, timeout: false }; }
}

async function reconcile(sb: any): Promise<number> {
  const { data: pend } = await sb.from("wa_followup_queue").select("id, conversation_id, created_at, rule_id, rule:wa_followup_rules(cenario)").in("status", ["pendente", "pendente_revisao", "enviado"]);
  if (!pend?.length) return 0;
  const cids = [...new Set(pend.map((f: any) => f.conversation_id))];
  const { data: msgs } = await sb.from("wa_messages").select("conversation_id, created_at, direction").in("conversation_id", cids).eq("is_internal_note", false).order("created_at", { ascending: false });
  if (!msgs) return 0;
  const li = new Map<string, string>(), lo = new Map<string, string>();
  for (const m of msgs) {
    if (m.direction === "in" && !li.has(m.conversation_id)) li.set(m.conversation_id, m.created_at);
    if (m.direction === "out" && !lo.has(m.conversation_id)) lo.set(m.conversation_id, m.created_at);
  }
  const ids: string[] = [];
  for (const f of pend) {
    const c = (f.rule as any)?.cenario;
    if (c === "equipe_sem_resposta") { const o = lo.get(f.conversation_id); if (o && o > f.created_at) { ids.push(f.id); continue; } }
    const i = li.get(f.conversation_id);
    if (i && i > f.created_at) ids.push(f.id);
  }
  if (ids.length) await sb.from("wa_followup_queue").update({ status: "respondido", responded_at: new Date().toISOString() }).in("id", ids);
  return ids.length;
}
