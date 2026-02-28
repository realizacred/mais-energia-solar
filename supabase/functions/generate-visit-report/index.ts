import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChecklistRow {
  status: string;
  observacao: string | null;
  item: { descricao: string; ordem: number } | null;
}

interface AttachmentRow {
  id: string;
  label: string | null;
  storage_path: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    // Get tenant_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("No tenant");
    const tenantId = profile.tenant_id;

    const { visitId } = await req.json();
    if (!visitId) throw new Error("visitId required");

    // 1. Fetch visit with joins
    const { data: visit, error: visitErr } = await supabase
      .from("post_sale_visits")
      .select(`
        *,
        cliente:clientes(nome, telefone, cidade, email),
        projeto:projetos(nome, codigo, potencia_kwp, endereco)
      `)
      .eq("id", visitId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (visitErr || !visit) throw new Error("Visit not found");

    // 2. Fetch company/tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, cnpj, telefone, email, cidade, estado")
      .eq("id", tenantId)
      .maybeSingle();

    // 3. Fetch checklist entries
    const { data: checklist } = await supabase
      .from("post_sale_visit_checklist")
      .select("status, observacao, item:post_sale_checklist_items(descricao, ordem)")
      .eq("visit_id", visitId)
      .eq("tenant_id", tenantId)
      .order("created_at") as { data: ChecklistRow[] | null };

    // 4. Fetch attachments
    const { data: attachments } = await supabase
      .from("post_sale_attachments")
      .select("id, label, storage_path")
      .eq("visit_id", visitId)
      .eq("tenant_id", tenantId)
      .order("created_at") as { data: AttachmentRow[] | null };

    // 5. Generate HTML for PDF
    const statusLabel: Record<string, string> = {
      ok: "✅ OK",
      atencao: "⚠️ Atenção",
      problema: "❌ Problema",
      na: "— N/A",
    };
    const tipoLabel: Record<string, string> = {
      preventiva: "Preventiva",
      limpeza: "Limpeza",
      suporte: "Suporte",
      vistoria: "Vistoria",
      corretiva: "Corretiva",
    };

    const visitDate = visit.data_conclusao
      ? new Date(visit.data_conclusao).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");
    const projectCode = visit.projeto?.codigo || visit.projeto?.nome || "SEM-CODIGO";

    // Build checklist rows HTML
    const checklistHtml = (checklist || [])
      .sort((a, b) => (a.item?.ordem ?? 0) - (b.item?.ordem ?? 0))
      .map(
        (c) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #ddd;">${c.item?.descricao || "—"}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${statusLabel[c.status] || c.status}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${c.observacao || ""}</td>
        </tr>`
      )
      .join("");

    // Build attachment list HTML
    const attachmentHtml = (attachments || [])
      .map((a) => `<li>${a.label || "Anexo"} <em style="color:#888;">(${a.storage_path.split("/").pop()})</em></li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
    h1 { font-size: 18px; color: #1a1a1a; margin-bottom: 4px; }
    h2 { font-size: 14px; color: #555; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 16px; }
    .info-grid .label { color: #888; font-size: 10px; text-transform: uppercase; }
    .info-grid .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #ddd; text-align: left; font-size: 11px; text-transform: uppercase; }
    td { font-size: 12px; }
    .footer { margin-top: 32px; text-align: center; color: #aaa; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${tenant?.nome || "Empresa"}</h1>
      <p style="color:#666;margin:0;">${tenant?.cnpj || ""} ${tenant?.telefone ? "· " + tenant.telefone : ""}</p>
      <p style="color:#666;margin:0;">${[tenant?.cidade, tenant?.estado].filter(Boolean).join("/") || ""}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:14px;font-weight:bold;">Relatório de Visita</p>
      <p style="color:#666;">${visitDate}</p>
    </div>
  </div>

  <h2>Dados da Visita</h2>
  <div class="info-grid">
    <div><span class="label">Cliente</span><br><span class="value">${visit.cliente?.nome || "—"}</span></div>
    <div><span class="label">Projeto</span><br><span class="value">${projectCode}</span></div>
    <div><span class="label">Potência</span><br><span class="value">${visit.projeto?.potencia_kwp ? visit.projeto.potencia_kwp + " kWp" : "—"}</span></div>
    <div><span class="label">Tipo</span><br><span class="value">${tipoLabel[visit.tipo] || visit.tipo}</span></div>
    <div><span class="label">Telefone</span><br><span class="value">${visit.cliente?.telefone || "—"}</span></div>
    <div><span class="label">Cidade</span><br><span class="value">${visit.cliente?.cidade || "—"}</span></div>
  </div>

  ${visit.observacoes ? `<h2>Observações</h2><p>${visit.observacoes}</p>` : ""}

  ${(checklist || []).length > 0 ? `
  <h2>Checklist de Inspeção</h2>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="width:100px;text-align:center;">Status</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>${checklistHtml}</tbody>
  </table>
  ` : ""}

  ${(attachments || []).length > 0 ? `
  <h2>Anexos (${attachments!.length})</h2>
  <ul>${attachmentHtml}</ul>
  ` : ""}

  <div class="footer">
    Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")} · ${tenant?.nome || ""}
  </div>
</body>
</html>`;

    // 6. Convert HTML to PDF using a simple approach
    // Since we can't use puppeteer in edge functions, we'll store the HTML as a styled document
    // that can be rendered as PDF by the browser. For server-side, we'll use the HTML directly.
    const pdfContent = new TextEncoder().encode(html);

    // 7. Upload to storage
    const fileName = `Relatorio_Visita_${projectCode}_${visitDate.replace(/\//g, "-")}.html`;
    const storagePath = `${tenantId}/${visitId}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("post_sale_reports")
      .upload(storagePath, pdfContent, {
        contentType: "text/html",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // 8. Insert/update report record
    const { error: dbErr } = await supabase
      .from("post_sale_reports")
      .upsert(
        {
          tenant_id: tenantId,
          visit_id: visitId,
          storage_path: storagePath,
          file_name: fileName,
        },
        { onConflict: "visit_id,tenant_id", ignoreDuplicates: false }
      );
    // If upsert fails due to no unique constraint, try insert
    if (dbErr) {
      // Delete existing and re-insert
      await supabase
        .from("post_sale_reports")
        .delete()
        .eq("visit_id", visitId)
        .eq("tenant_id", tenantId);
      await supabase
        .from("post_sale_reports")
        .insert({
          tenant_id: tenantId,
          visit_id: visitId,
          storage_path: storagePath,
          file_name: fileName,
        });
    }

    return new Response(
      JSON.stringify({ success: true, storagePath, fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-visit-report]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
