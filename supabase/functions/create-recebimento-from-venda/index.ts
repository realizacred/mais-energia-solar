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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await anonClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { venda_id, cliente_id, tenant_id } = body;

    if (!venda_id || !cliente_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: venda_id, cliente_id, tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if recebimento already exists for this venda (via projeto_id link)
    const { data: venda, error: vendaError } = await supabase
      .from("vendas")
      .select("id, cliente_id, projeto_id, valor_total_bruto, tenant_id")
      .eq("id", venda_id)
      .single();

    if (vendaError || !venda) {
      return new Response(
        JSON.stringify({ error: "Venda não encontrada", details: vendaError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing recebimento linked to the same projeto
    if (venda.projeto_id) {
      const { data: existing } = await supabase
        .from("recebimentos")
        .select("id")
        .eq("projeto_id", venda.projeto_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, already_exists: true, recebimento_id: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Fetch venda_pagamentos → venda_pagamento_itens → venda_pagamento_parcelas
    const { data: pagamentos } = await supabase
      .from("venda_pagamentos")
      .select("id")
      .eq("venda_id", venda_id)
      .order("created_at", { ascending: false })
      .limit(1);

    let allParcelas: Array<{
      numero_parcela: number;
      valor: number;
      vencimento: string;
      forma_pagamento?: string;
    }> = [];
    let formaPrincipal = "pix";

    if (pagamentos && pagamentos.length > 0) {
      const pagamentoId = pagamentos[0].id;

      // Get items for forma_pagamento
      const { data: itens } = await supabase
        .from("venda_pagamento_itens")
        .select("id, forma_pagamento, valor_base")
        .eq("venda_pagamento_id", pagamentoId)
        .order("ordem");

      if (itens && itens.length > 0) {
        // forma principal = item with highest valor_base
        const sorted = [...itens].sort((a, b) => (b.valor_base || 0) - (a.valor_base || 0));
        formaPrincipal = sorted[0].forma_pagamento || "pix";

        // Get all parcelas from all items
        const itemIds = itens.map((i) => i.id);
        const { data: parcelas } = await supabase
          .from("venda_pagamento_parcelas")
          .select("numero_parcela, valor, vencimento, venda_pagamento_item_id")
          .in("venda_pagamento_item_id", itemIds)
          .order("vencimento");

        if (parcelas && parcelas.length > 0) {
          // Aggregate parcelas by vencimento (since multiple items may have parcelas on same date)
          const parcelaMap = new Map<string, number>();
          for (const p of parcelas) {
            const key = p.vencimento;
            parcelaMap.set(key, (parcelaMap.get(key) || 0) + (p.valor || 0));
          }

          let num = 1;
          for (const [vencimento, valor] of parcelaMap) {
            allParcelas.push({ numero_parcela: num++, valor, vencimento });
          }
        }
      }
    }

    // Fallback: if no parcelas found, create single parcela with total value
    const valorTotal = allParcelas.length > 0
      ? allParcelas.reduce((sum, p) => sum + p.valor, 0)
      : venda.valor_total_bruto || 0;

    if (allParcelas.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      allParcelas = [{ numero_parcela: 1, valor: valorTotal, vencimento: today }];
    }

    // 3. Create recebimento
    const { data: recebimento, error: recError } = await supabase
      .from("recebimentos")
      .insert({
        cliente_id: cliente_id,
        projeto_id: venda.projeto_id || null,
        tenant_id: tenant_id,
        valor_total: valorTotal,
        numero_parcelas: allParcelas.length,
        forma_pagamento_acordada: formaPrincipal,
        data_acordo: new Date().toISOString().split("T")[0],
        status: "aguardando_instalacao",
        descricao: "Recebimento gerado automaticamente na aprovação da venda",
      })
      .select("id")
      .single();

    if (recError || !recebimento) {
      console.error("[create-recebimento] Insert error:", recError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar recebimento", details: recError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create parcelas
    const parcelasInsert = allParcelas.map((p) => ({
      recebimento_id: recebimento.id,
      numero_parcela: p.numero_parcela,
      valor: p.valor,
      data_vencimento: p.vencimento,
      status: "pendente",
      tenant_id: tenant_id,
    }));

    const { error: parcelasError } = await supabase
      .from("parcelas")
      .insert(parcelasInsert);

    if (parcelasError) {
      console.error("[create-recebimento] Parcelas error:", parcelasError);
      // Don't fail completely — recebimento was created, parcelas can be added manually
    }

    return new Response(
      JSON.stringify({
        success: true,
        recebimento_id: recebimento.id,
        parcelas_criadas: parcelasError ? 0 : allParcelas.length,
        valor_total: valorTotal,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-recebimento] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
