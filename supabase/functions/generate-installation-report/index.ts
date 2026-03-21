import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("No tenant");
    const tenantId = profile.tenant_id;

    const { checklist_id } = await req.json();
    if (!checklist_id) throw new Error("checklist_id required");

    // 1. Fetch checklist with joins
    const { data: checklist, error: clErr } = await supabase
      .from("checklists_instalador")
      .select(`
        *,
        cliente:clientes(nome, telefone, cidade, estado, rua, bairro, numero),
        projeto:projetos(nome, codigo, potencia_kwp)
      `)
      .eq("id", checklist_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (clErr || !checklist) throw new Error("Checklist not found");

    // 2. Fetch tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, cnpj, telefone, email, cidade, estado")
      .eq("id", tenantId)
      .maybeSingle();

    // 3. Fetch instalador name
    const { data: instalador } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", checklist.instalador_id)
      .maybeSingle();

    // 4. Fetch template items + respostas
    const { data: items } = await supabase
      .from("checklist_template_items")
      .select("id, campo, obrigatorio, etapa, ordem")
      .eq("template_id", checklist.template_id)
      .eq("tenant_id", tenantId)
      .order("ordem");

    const { data: respostas } = await supabase
      .from("checklist_instalador_respostas")
      .select("template_item_id, valor_boolean, observacao, campo, fase")
      .eq("checklist_id", checklist_id)
      .eq("tenant_id", tenantId);

    // 5. Fetch fotos
    const { data: arquivos } = await supabase
      .from("checklist_instalador_arquivos")
      .select("url, nome_arquivo, categoria, fase")
      .eq("checklist_id", checklist_id)
      .eq("tenant_id", tenantId);

    // 6. Build checklist items HTML
    const respostaMap = new Map(
      (respostas || []).map((r) => [r.template_item_id, r])
    );

    const itemsHtml = (items || [])
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((item) => {
        const resp = respostaMap.get(item.id);
        const status =
          resp?.valor_boolean === true
            ? '<span style="color:#16a34a;font-weight:bold;">✓</span>'
            : resp?.valor_boolean === false
            ? '<span style="color:#dc2626;font-weight:bold;">✗</span>'
            : '<span style="color:#9ca3af;">—</span>';
        return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;">${item.campo}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;width:60px;">${status}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#666;font-size:11px;">${resp?.observacao || ""}</td>
        </tr>`;
      })
      .join("");

    // 7. Build fotos HTML (3 per row)
    const fotosArr = (arquivos || []).filter((a) => a.url);
    let fotosHtml = "";
    if (fotosArr.length > 0) {
      const cells = fotosArr
        .map(
          (f) =>
            `<td style="padding:4px;width:33%;vertical-align:top;">
              <img src="${f.url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:4px;" />
              <p style="font-size:9px;color:#888;margin:2px 0 0;">${f.nome_arquivo || f.categoria || ""}</p>
            </td>`
        )
        .reduce((rows: string[][], cell, i) => {
          if (i % 3 === 0) rows.push([]);
          rows[rows.length - 1].push(cell);
          return rows;
        }, [])
        .map((row) => `<tr>${row.join("")}</tr>`)
        .join("");
      fotosHtml = `
      <h2>Registro Fotográfico (${fotosArr.length})</h2>
      <table style="width:100%;border-collapse:collapse;">${cells}</table>`;
    }

    // 8. Signatures
    let signatureHtml = "";
    const sigInstalador = checklist.assinatura_instalador_url;
    const sigCliente = checklist.assinatura_cliente_url;
    if (sigInstalador || sigCliente) {
      signatureHtml = `
      <h2>Assinaturas</h2>
      <table style="width:100%;">
        <tr>
          <td style="width:50%;text-align:center;padding:8px;">
            ${sigInstalador ? `<img src="${sigInstalador}" style="max-height:80px;" />` : '<p style="color:#aaa;">Não assinado</p>'}
            <p style="border-top:1px solid #333;display:inline-block;padding-top:4px;font-size:11px;margin-top:8px;">
              ${instalador?.full_name || "Instalador"}
            </p>
          </td>
          <td style="width:50%;text-align:center;padding:8px;">
            ${sigCliente ? `<img src="${sigCliente}" style="max-height:80px;" />` : '<p style="color:#aaa;">Não assinado</p>'}
            <p style="border-top:1px solid #333;display:inline-block;padding-top:4px;font-size:11px;margin-top:8px;">
              ${checklist.cliente?.nome || "Cliente"}
            </p>
          </td>
        </tr>
      </table>`;
    }

    // 9. Dates
    const dataInstalacao = checklist.data_inicio
      ? new Date(checklist.data_inicio).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : checklist.data_agendada || "—";
    const dataConclusao = checklist.data_fim
      ? new Date(checklist.data_fim).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "—";
    const projetoCodigo = checklist.projeto?.codigo || checklist.projeto?.nome || "SEM-CODIGO";
    const doneCount = (respostas || []).filter((r) => r.valor_boolean === true).length;
    const totalCount = (items || []).length;

    // 10. Build full HTML
    const html = `<!DOCTYPE html>
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
    th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px; text-transform: uppercase; }
    td { font-size: 12px; }
    .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-top: 8px; }
    .footer { margin-top: 32px; text-align: center; color: #aaa; font-size: 10px; border-top: 1px solid #eee; padding-top: 8px; }
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
      <p style="font-size:14px;font-weight:bold;">Relatório de Instalação</p>
      <p style="color:#666;">Projeto: ${projetoCodigo}</p>
    </div>
  </div>

  <h2>Dados do Projeto</h2>
  <div class="info-grid">
    <div><span class="label">Cliente</span><br><span class="value">${checklist.cliente?.nome || "—"}</span></div>
    <div><span class="label">Projeto</span><br><span class="value">${projetoCodigo}</span></div>
    <div><span class="label">Potência</span><br><span class="value">${checklist.projeto?.potencia_kwp ? checklist.projeto.potencia_kwp + " kWp" : "—"}</span></div>
    <div><span class="label">Instalador</span><br><span class="value">${instalador?.full_name || "—"}</span></div>
    <div><span class="label">Endereço</span><br><span class="value">${[checklist.endereco || checklist.cliente?.rua, checklist.cliente?.numero, checklist.bairro || checklist.cliente?.bairro].filter(Boolean).join(", ") || "—"}</span></div>
    <div><span class="label">Cidade</span><br><span class="value">${checklist.cidade || checklist.cliente?.cidade || "—"}</span></div>
    <div><span class="label">Data Instalação</span><br><span class="value">${dataInstalacao}</span></div>
    <div><span class="label">Data Conclusão</span><br><span class="value">${dataConclusao}</span></div>
  </div>

  <h2>Checklist de Instalação</h2>
  <div class="summary">
    <strong>${doneCount}/${totalCount}</strong> itens concluídos · Status: <strong>${checklist.status}</strong>
  </div>
  <table style="margin-top:12px;">
    <thead>
      <tr>
        <th>Item</th>
        <th style="width:60px;text-align:center;">Status</th>
        <th>Observação</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  ${checklist.observacoes ? `<h2>Observações Gerais</h2><p>${checklist.observacoes}</p>` : ""}
  ${checklist.pendencias ? `<h2>Pendências</h2><p style="color:#dc2626;">${checklist.pendencias}</p>` : ""}

  ${fotosHtml}
  ${signatureHtml}

  <div class="footer">
    Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${tenant?.nome || ""}
  </div>
</body>
</html>`;

    // Return HTML as PDF-ready content
    // The client will handle the download
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="Relatorio_Instalacao_${projetoCodigo}.html"`,
      },
    });
  } catch (err) {
    console.error("[generate-installation-report]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
