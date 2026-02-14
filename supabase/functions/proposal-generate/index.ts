import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  lead_id: string;
  projeto_id?: string;
  cliente_id?: string;
  grupo: "A" | "B";
  template_id?: string;
  dados_tecnicos: {
    potencia_kwp: number;
    consumo_medio_kwh: number;
    tipo_fase: "monofasico" | "bifasico" | "trifasico";
    concessionaria_id?: string;
    estado: string;
  };
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    categoria: string;
  }>;
  mao_de_obra?: number;
  desconto_percentual?: number;
  observacoes?: string;
  idempotency_key: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonError("Token inválido", 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id || !profile.ativo) {
      return jsonError("Usuário inativo ou sem tenant", 403);
    }
    const tenantId = profile.tenant_id;

    // Verificar tenant ativo
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("id, status, nome, estado")
      .eq("id", tenantId)
      .single();

    if (!tenant || tenant.status !== "active") {
      return jsonError("Tenant suspenso ou inativo", 403);
    }

    // Verificar permissão
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "gerente", "financeiro", "consultor"];
    const hasPermission = roles?.some((r: any) =>
      allowedRoles.includes(r.role)
    );
    if (!hasPermission) {
      return jsonError("Sem permissão para gerar propostas", 403);
    }

    // ── 2. PARSE PAYLOAD ────────────────────────────────────
    const body: GenerateRequest = await req.json();

    if (!body.lead_id || !body.grupo || !body.dados_tecnicos || !body.itens) {
      return jsonError(
        "Campos obrigatórios: lead_id, grupo, dados_tecnicos, itens",
        400
      );
    }
    if (!body.idempotency_key) {
      return jsonError("idempotency_key é obrigatório", 400);
    }
    if (!["A", "B"].includes(body.grupo)) {
      return jsonError("grupo deve ser A ou B", 400);
    }

    // ── 3. IDEMPOTÊNCIA: verificar se já existe ─────────────
    const { data: existingVersion } = await adminClient
      .from("proposta_versoes")
      .select(
        "id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal"
      )
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();

    if (existingVersion) {
      return jsonOk({
        success: true,
        idempotent: true,
        proposta_id: existingVersion.proposta_id,
        versao_id: existingVersion.id,
        versao_numero: existingVersion.versao_numero,
        valor_total: existingVersion.valor_total,
        payback_meses: existingVersion.payback_meses,
        economia_mensal: existingVersion.economia_mensal,
      });
    }

    // ── 4. DADOS AUXILIARES (Lei 14.300) ─────────────────────
    const estado = body.dados_tecnicos.estado;
    const anoAtual = new Date().getFullYear();

    // [C] Fio B: buscar por tenant OU global (tenant_id IS NULL), preferindo tenant
    const { data: fioBRows } = await adminClient
      .from("fio_b_escalonamento")
      .select("ano, percentual_nao_compensado, tenant_id")
      .eq("ano", anoAtual)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false })
      .limit(1);

    const fioB = fioBRows?.[0] ?? null;
    // [C] Fallback 0% (conservador: não inflar custo ao cliente)
    // EVIDÊNCIA NECESSÁRIA: valor oficial depende do ano de homologação do sistema
    const percentualFioB = fioB?.percentual_nao_compensado ?? 0;

    // Tributação
    const { data: tributacao } = await adminClient
      .from("config_tributaria_estado")
      .select("aliquota_icms, possui_isencao_scee, percentual_isencao")
      .eq("estado", estado)
      .maybeSingle();

    const aliquotaIcms = tributacao?.aliquota_icms ?? 0.25;
    const possuiIsencao = tributacao?.possui_isencao_scee ?? false;
    const percentualIsencao = tributacao?.percentual_isencao ?? 0;

    // Irradiação (tenant-specific ou global)
    const { data: irradiacao } = await adminClient
      .from("irradiacao_por_estado")
      .select("geracao_media_kwp_mes")
      .eq("estado", estado)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("tenant_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const geracaoMediaKwpMes = irradiacao?.geracao_media_kwp_mes ?? 120;

    // Concessionária
    let concessionariaData: any = null;
    if (body.dados_tecnicos.concessionaria_id) {
      const { data: conc } = await adminClient
        .from("concessionarias")
        .select(
          "nome, sigla, tarifa_energia, tarifa_fio_b, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico"
        )
        .eq("id", body.dados_tecnicos.concessionaria_id)
        .eq("tenant_id", tenantId)
        .single();
      concessionariaData = conc;
    }

    // ── 5. CÁLCULO ──────────────────────────────────────────
    const potenciaKwp = body.dados_tecnicos.potencia_kwp;
    const consumoMedio = body.dados_tecnicos.consumo_medio_kwh;
    const tipoFase = body.dados_tecnicos.tipo_fase;

    const geracaoEstimada = potenciaKwp * geracaoMediaKwpMes;

    const tarifaEnergia = concessionariaData?.tarifa_energia ?? 0.85;
    const tarifaFioB =
      concessionariaData?.tarifa_fio_b ?? tarifaEnergia * 0.28;

    const custoDispMap: Record<string, string> = {
      monofasico: "custo_disponibilidade_monofasico",
      bifasico: "custo_disponibilidade_bifasico",
      trifasico: "custo_disponibilidade_trifasico",
    };
    const custoDisponibilidade =
      concessionariaData?.[custoDispMap[tipoFase]] ?? 100;

    const energiaCompensavel = Math.min(geracaoEstimada, consumoMedio);
    const fioBAplicavel = body.grupo === "B" ? percentualFioB / 100 : 0;
    const custoFioBMensal = energiaCompensavel * tarifaFioB * fioBAplicavel;
    const economiaBruta = energiaCompensavel * tarifaEnergia;
    const economiaMensal = Math.max(
      economiaBruta - custoFioBMensal - custoDisponibilidade,
      0
    );

    const itensComSubtotal = body.itens.map((item) => ({
      ...item,
      subtotal: item.quantidade * item.preco_unitario,
    }));
    const subtotalEquipamentos = itensComSubtotal.reduce(
      (sum, i) => sum + i.subtotal,
      0
    );
    const maodeObra = body.mao_de_obra ?? 0;
    const descontoPercent = body.desconto_percentual ?? 0;
    const subtotalBruto = subtotalEquipamentos + maodeObra;
    const descontoValor = subtotalBruto * (descontoPercent / 100);
    const valorTotal = subtotalBruto - descontoValor;

    const paybackMeses =
      economiaMensal > 0 ? Math.ceil(valorTotal / economiaMensal) : 0;
    const economiaAnual = economiaMensal * 12;
    const roi25anos = economiaAnual * 25;

    // Resolver consultor_id
    const { data: consultor } = await adminClient
      .from("consultores")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .maybeSingle();

    const consultorId = consultor?.id ?? null;

    // ── 6. SNAPSHOT IMUTÁVEL ────────────────────────────────
    const snapshot = {
      versao_schema: 1,
      gerado_em: new Date().toISOString(),
      grupo: body.grupo,
      regra_lei_14300: {
        versao: `${anoAtual}-01`,
        fio_b_ano: anoAtual,
        percentual_fio_b: fioBAplicavel,
        percentual_nao_compensado: percentualFioB,
        fonte: fioB ? "fio_b_escalonamento" : "fallback_zero",
      },
      tributacao: {
        estado,
        aliquota_icms: aliquotaIcms,
        possui_isencao_scee: possuiIsencao,
        percentual_isencao: percentualIsencao,
        concessionaria: concessionariaData?.nome ?? null,
        concessionaria_sigla: concessionariaData?.sigla ?? null,
        tarifa_energia: tarifaEnergia,
        tarifa_fio_b: tarifaFioB,
        custo_disponibilidade: custoDisponibilidade,
        tipo_fase: tipoFase,
      },
      tecnico: {
        potencia_kwp: potenciaKwp,
        consumo_medio_kwh: consumoMedio,
        geracao_estimada_kwh: Math.round(geracaoEstimada * 100) / 100,
        irradiacao_media_kwp_mes: geracaoMediaKwpMes,
        energia_compensavel_kwh: energiaCompensavel,
      },
      itens: itensComSubtotal,
      financeiro: {
        subtotal_equipamentos: subtotalEquipamentos,
        mao_de_obra: maodeObra,
        desconto_percentual: descontoPercent,
        desconto_valor: Math.round(descontoValor * 100) / 100,
        valor_total: Math.round(valorTotal * 100) / 100,
        economia_mensal: Math.round(economiaMensal * 100) / 100,
        economia_anual: Math.round(economiaAnual * 100) / 100,
        payback_meses: paybackMeses,
        roi_25_anos: Math.round(roi25anos * 100) / 100,
      },
      inputs: {
        lead_id: body.lead_id,
        projeto_id: body.projeto_id ?? null,
        cliente_id: body.cliente_id ?? null,
        template_id: body.template_id ?? null,
        consultor_id: consultorId,
        user_id: userId,
      },
    };

    // ── 7. CRIAR OU REUTILIZAR propostas_nativas ────────────
    let propostaId: string;

    const matchFilter: any = { tenant_id: tenantId, lead_id: body.lead_id };
    if (body.projeto_id) matchFilter.projeto_id = body.projeto_id;

    const { data: existingProposta } = await adminClient
      .from("propostas_nativas")
      .select("id")
      .match(matchFilter)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingProposta) {
      propostaId = existingProposta.id;
    } else {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, lead_code")
        .eq("id", body.lead_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!lead) {
        return jsonError("Lead não encontrado neste tenant", 404);
      }

      const titulo = `Proposta ${lead.lead_code ?? ""} - ${lead.nome}`.trim();

      const { data: novaProposta, error: insertErr } = await adminClient
        .from("propostas_nativas")
        .insert({
          tenant_id: tenantId,
          lead_id: body.lead_id,
          projeto_id: body.projeto_id ?? null,
          cliente_id: body.cliente_id ?? null,
          consultor_id: consultorId,
          template_id: body.template_id ?? null,
          titulo,
          codigo: lead.lead_code ? `PROP-${lead.lead_code}` : null,
          versao_atual: 0, // será atualizado pela RPC
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertErr || !novaProposta) {
        return jsonError(`Erro ao criar proposta: ${insertErr?.message}`, 500);
      }
      propostaId = novaProposta.id;
    }

    // ── 8. [B] VERSÃO ATÔMICA via RPC ───────────────────────
    const { data: versaoNumero, error: rpcErr } = await adminClient.rpc(
      "next_proposta_versao_numero",
      { _proposta_id: propostaId }
    );

    if (rpcErr || !versaoNumero) {
      return jsonError(
        `Erro ao gerar número de versão: ${rpcErr?.message}`,
        500
      );
    }

    // ── 9. INSERIR proposta_versoes ─────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .insert({
        tenant_id: tenantId,
        proposta_id: propostaId,
        versao_numero: versaoNumero,
        status: "generated",
        grupo: body.grupo,
        potencia_kwp: potenciaKwp,
        valor_total: Math.round(valorTotal * 100) / 100,
        economia_mensal: Math.round(economiaMensal * 100) / 100,
        payback_meses: paybackMeses,
        validade_dias: 30,
        valido_ate: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .split("T")[0],
        snapshot,
        snapshot_locked: true,
        idempotency_key: body.idempotency_key,
        observacoes: body.observacoes ?? null,
        gerado_por: userId,
        gerado_em: new Date().toISOString(),
      })
      .select(
        "id, versao_numero, valor_total, payback_meses, economia_mensal"
      )
      .single();

    if (versaoErr) {
      // Conflito de idempotency_key = retornar existente
      if (versaoErr.code === "23505") {
        const { data: dup } = await adminClient
          .from("proposta_versoes")
          .select(
            "id, proposta_id, versao_numero, valor_total, payback_meses, economia_mensal"
          )
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", body.idempotency_key)
          .single();
        if (dup) {
          return jsonOk({
            success: true,
            idempotent: true,
            proposta_id: dup.proposta_id,
            versao_id: dup.id,
            versao_numero: dup.versao_numero,
            valor_total: dup.valor_total,
            payback_meses: dup.payback_meses,
            economia_mensal: dup.economia_mensal,
          });
        }
      }
      // Conflito de versao_numero (race extremamente raro) — retry 1x
      if (
        versaoErr.code === "23505" &&
        versaoErr.message?.includes("uq_proposta_versao")
      ) {
        const { data: retryNum } = await adminClient.rpc(
          "next_proposta_versao_numero",
          { _proposta_id: propostaId }
        );
        if (retryNum) {
          const { data: retryVersao, error: retryErr } = await adminClient
            .from("proposta_versoes")
            .insert({
              tenant_id: tenantId,
              proposta_id: propostaId,
              versao_numero: retryNum,
              status: "generated",
              grupo: body.grupo,
              potencia_kwp: potenciaKwp,
              valor_total: Math.round(valorTotal * 100) / 100,
              economia_mensal: Math.round(economiaMensal * 100) / 100,
              payback_meses: paybackMeses,
              validade_dias: 30,
              valido_ate: new Date(Date.now() + 30 * 86400000)
                .toISOString()
                .split("T")[0],
              snapshot,
              snapshot_locked: true,
              idempotency_key: body.idempotency_key,
              observacoes: body.observacoes ?? null,
              gerado_por: userId,
              gerado_em: new Date().toISOString(),
            })
            .select(
              "id, versao_numero, valor_total, payback_meses, economia_mensal"
            )
            .single();
          if (!retryErr && retryVersao) {
            return jsonOk({
              success: true,
              idempotent: false,
              proposta_id: propostaId,
              versao_id: retryVersao.id,
              versao_numero: retryVersao.versao_numero,
              valor_total: retryVersao.valor_total,
              payback_meses: retryVersao.payback_meses,
              economia_mensal: retryVersao.economia_mensal,
            });
          }
        }
      }
      return jsonError(`Erro ao criar versão: ${versaoErr.message}`, 500);
    }

    return jsonOk({
      success: true,
      idempotent: false,
      proposta_id: propostaId,
      versao_id: versao!.id,
      versao_numero: versao!.versao_numero,
      valor_total: versao!.valor_total,
      payback_meses: versao!.payback_meses,
      economia_mensal: versao!.economia_mensal,
    });
  } catch (err) {
    console.error("[proposal-generate] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
