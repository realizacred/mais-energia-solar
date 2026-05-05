// Envia recibo via WhatsApp.
// 1) Busca recibo + cliente (RLS via JWT do caller).
// 2) Garante PDF gerado (chama generate-recibo-pdf se necessário).
// 3) Cria URL assinada do PDF.
// 4) Enfileira mensagem WhatsApp via enqueue_wa_outbox_item (service role).
// 5) Atualiza status do recibo p/ 'enviado' e grava recibo_logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const body = await req.json().catch(() => ({}));
    const { recibo_id, telefone: telefoneOverride, mensagem: mensagemOverride } = body ?? {};
    if (!recibo_id) {
      return new Response(JSON.stringify({ error: "recibo_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Buscar recibo + cliente (RLS)
    const { data: recibo, error: recErr } = await userClient
      .from("recibos_emitidos")
      .select("id, tenant_id, valor, descricao, numero, pdf_path, status, cliente:clientes(id, nome, telefone)")
      .eq("id", recibo_id)
      .maybeSingle();

    if (recErr || !recibo) {
      return new Response(JSON.stringify({ error: "Recibo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cliente: any = (recibo as any).cliente;
    const telefoneRaw = (telefoneOverride ?? cliente?.telefone ?? "").toString();
    const telefone = telefoneRaw.replace(/\D/g, "");
    if (!telefone || telefone.length < 10) {
      return new Response(JSON.stringify({ error: "Telefone do cliente inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Garantir PDF
    let pdfPath = (recibo as any).pdf_path as string | null;
    if (!pdfPath) {
      const gen = await userClient.functions.invoke("generate-recibo-pdf", {
        body: { recibo_id },
      });
      if (gen.error) {
        return new Response(JSON.stringify({ error: "Falha ao gerar PDF: " + gen.error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfPath = (gen.data as any)?.pdf_path ?? null;
    }
    if (!pdfPath) {
      return new Response(JSON.stringify({ error: "PDF do recibo indisponível" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) URL assinada (24h)
    const { data: signed, error: signErr } = await userClient.storage
      .from("recibos")
      .createSignedUrl(pdfPath, 60 * 60 * 24);
    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "Falha ao assinar URL do PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const linkPdf = signed.signedUrl;

    // 4) Service-role admin: instância + enqueue + update + log
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tenantId = (recibo as any).tenant_id as string;

    const { data: waInstance } = await admin
      .from("wa_instances")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!waInstance) {
      return new Response(JSON.stringify({ error: "Nenhuma instância WhatsApp conectada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = `${telefone}@s.whatsapp.net`;
    const valorBRL = fmtBRL(Number((recibo as any).valor || 0));
    const nomeCli = cliente?.nome ?? "Cliente";

    const mensagem = (mensagemOverride && String(mensagemOverride).trim())
      ? String(mensagemOverride)
      : [
          `Olá ${nomeCli}, segue seu recibo no valor de ${valorBRL}:`,
          "",
          linkPdf,
          (recibo as any).descricao ? `\n_${(recibo as any).descricao}_` : "",
        ].filter(Boolean).join("\n");

    const idempKey = `recibo_envio:${recibo_id}:${Date.now()}`;
    const { error: enqErr } = await admin.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: tenantId,
      p_instance_id: (waInstance as any).id,
      p_remote_jid: remoteJid,
      p_message_type: "text",
      p_content: mensagem,
      p_idempotency_key: idempKey,
    });
    if (enqErr) {
      console.error("[enviar-recibo-wa] enqueue:", enqErr.message);
      return new Response(JSON.stringify({ error: "Falha ao enfileirar mensagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Atualizar status + log
    await admin.from("recibos_emitidos")
      .update({ status: "enviado" })
      .eq("id", recibo_id);

    await admin.from("recibo_logs").insert({
      tenant_id: tenantId,
      recibo_id,
      tipo: "envio",
      canal: "whatsapp",
      destino: telefone,
      mensagem,
      meta: { instance_id: (waInstance as any).id, link_pdf_signed: linkPdf },
    });

    return new Response(JSON.stringify({ success: true, link_pdf: linkPdf }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[enviar-recibo-wa] erro:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
