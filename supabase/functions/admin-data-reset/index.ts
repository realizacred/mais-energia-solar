import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Segment definitions: which tables to truncate per segment
const SEGMENTS: Record<string, { label: string; tables: string[] }> = {
  crm: {
    label: "CRM (Leads + Orçamentos + Simulações)",
    tables: [
      "simulacoes",
      "orcamentos",
      "leads",
    ],
  },
  clientes: {
    label: "Clientes + Projetos + Financeiro",
    tables: [
      "comissoes",
      "parcelas",
      "projetos",
      "clientes",
    ],
  },
  whatsapp: {
    label: "WhatsApp (Conversas + Mensagens)",
    tables: [
      "wa_outbox",
      "wa_webhook_events",
      "wa_messages",
      "wa_conversations",
    ],
  },
  followups: {
    label: "Follow-ups + Automações",
    tables: [
      "wa_followup_queue",
      "whatsapp_automation_logs",
    ],
  },
  checklists: {
    label: "Checklists (Instalação + Documentação)",
    tables: [
      "checklist_cliente_arquivos",
      "checklist_cliente_respostas",
      "checklists_cliente",
      "checklist_instalador_arquivos",
      "checklist_instalador_respostas",
      "checklists_instalador",
      "checklists_instalacao",
    ],
  },
  audit: {
    label: "Audit Logs + Contadores",
    tables: [
      "audit_logs",
      "lead_distribution_log",
      "usage_events",
      "usage_counters",
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate auth — must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, segments } = body;

    // ── Action: counts ──
    if (action === "counts") {
      const counts: Record<string, Record<string, number>> = {};
      for (const [key, seg] of Object.entries(SEGMENTS)) {
        counts[key] = {};
        for (const table of seg.tables) {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });
          counts[key][table] = error ? -1 : (count ?? 0);
        }
      }
      return new Response(JSON.stringify({ counts, segments: Object.fromEntries(
        Object.entries(SEGMENTS).map(([k, v]) => [k, v.label])
      ) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: reset ──
    if (action === "reset") {
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        return new Response(JSON.stringify({ error: "No segments selected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate all segments
      for (const seg of segments) {
        if (!SEGMENTS[seg]) {
          return new Response(JSON.stringify({ error: `Invalid segment: ${seg}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Collect all tables to truncate (order matters for FK)
      const allTables: string[] = [];
      for (const seg of segments) {
        for (const t of SEGMENTS[seg].tables) {
          if (!allTables.includes(t)) allTables.push(t);
        }
      }

      // Handle audit_logs immutability triggers
      const hasAudit = segments.includes("audit");
      
      // Build SQL
      const sqlParts: string[] = [];
      
      if (hasAudit) {
        sqlParts.push("DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;");
        sqlParts.push("DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;");
        sqlParts.push("DROP TRIGGER IF EXISTS guard_audit_log_insert ON audit_logs;");
      }

      sqlParts.push(`TRUNCATE TABLE ${allTables.join(", ")} CASCADE;`);

      // Reset sequences if CRM is included
      if (segments.includes("crm")) {
        sqlParts.push("ALTER SEQUENCE IF EXISTS public.lead_code_seq RESTART WITH 1;");
        sqlParts.push("ALTER SEQUENCE IF EXISTS public.orcamento_code_seq RESTART WITH 1;");
      }

      if (hasAudit) {
        sqlParts.push(`
          CREATE TRIGGER prevent_audit_log_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();
          CREATE TRIGGER prevent_audit_log_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();
          CREATE TRIGGER guard_audit_log_insert BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION guard_audit_log_insert();
        `);
      }

      const fullSql = sqlParts.join("\n");

      // Execute via service role RPC or direct SQL
      const { error: execError } = await supabase.rpc("exec_sql", { sql: fullSql }).maybeSingle();
      
      if (execError) {
        // Fallback: try executing statements individually via postgrest
        console.error("exec_sql failed, trying direct approach:", execError);
        
        // Use the database URL directly
        const dbUrl = Deno.env.get("SUPABASE_DB_URL");
        if (!dbUrl) {
          return new Response(JSON.stringify({ 
            error: "Database reset requires exec_sql RPC or SUPABASE_DB_URL",
            detail: execError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Use pg module for direct DB access
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
        const sql = postgres(dbUrl, { max: 1 });
        
        try {
          await sql.unsafe(fullSql);
          await sql.end();
        } catch (dbError: any) {
          await sql.end();
          return new Response(JSON.stringify({ error: dbError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        segments_reset: segments,
        tables_truncated: allTables,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'counts' or 'reset'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("admin-data-reset error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
