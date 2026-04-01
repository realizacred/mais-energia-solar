import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface ParsedPayment {
  ref: string | null;
  paid: boolean;
  value: number;
  paidAt: string;
}

function parsePagSeguro(payload: Record<string, unknown>): ParsedPayment {
  const status = String(payload?.status ?? "");
  const refId = String(payload?.reference_id ?? "");
  const amount = payload?.amount as Record<string, unknown> | undefined;
  const valueCents = Number(amount?.value ?? 0);

  return {
    ref: refId || null,
    paid: ["PAID", "AVAILABLE"].includes(status),
    value: valueCents / 100,
    paidAt: new Date().toISOString(),
  };
}

function parseAsaas(payload: Record<string, unknown>): ParsedPayment {
  const event = String(payload?.event ?? "");
  const payment = payload?.payment as Record<string, unknown> | undefined;

  return {
    ref: String(payment?.externalReference ?? "") || null,
    paid: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event),
    value: Number(payment?.value ?? 0),
    paidAt: String(payment?.paymentDate ?? new Date().toISOString()),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway") ?? "";

    if (!["pagseguro", "asaas"].includes(gateway)) {
      return new Response(
        JSON.stringify({ error: "Unknown gateway" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const payload = await req.json();

    const parsed: ParsedPayment = gateway === "asaas"
      ? parseAsaas(payload)
      : parsePagSeguro(payload);

    // Validate reference format
    if (!parsed.ref || !/^parcela_[0-9a-f-]{36}$/i.test(parsed.ref)) {
      return new Response(
        JSON.stringify({ error: "Invalid reference_id format" }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Not a payment confirmation event — acknowledge and exit
    if (!parsed.paid) {
      return new Response(
        JSON.stringify({ received: true }),
        { headers: corsHeaders },
      );
    }

    const parcelaId = parsed.ref.replace("parcela_", "");

    // Fetch parcela
    const { data: parcela, error: fetchErr } = await supabase
      .from("parcelas")
      .select("id, recebimento_id, valor, status, tenant_id, cobranca_valor_cobrado")
      .eq("id", parcelaId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[webhook-cobranca] DB fetch error:", fetchErr.message);
      return new Response(
        JSON.stringify({ error: "DB error" }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!parcela) {
      return new Response(
        JSON.stringify({ error: "Parcela not found" }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Idempotent: already paid
    if (parcela.status === "paga") {
      return new Response(
        JSON.stringify({ received: true }),
        { headers: corsHeaders },
      );
    }

    // Update parcela to paid
    const { error: updateErr } = await supabase
      .from("parcelas")
      .update({
        status: "paga",
        cobranca_status: "pago",
        cobranca_paga_em: new Date().toISOString(),
        webhook_payload: payload,
      })
      .eq("id", parcelaId);

    if (updateErr) {
      console.error("[webhook-cobranca] Update error:", updateErr.message);
    }

    // Create pagamento record
    const valorPago = parcela.cobranca_valor_cobrado ?? parsed.value ?? parcela.valor;
    const { error: insertErr } = await supabase
      .from("pagamentos")
      .insert({
        recebimento_id: parcela.recebimento_id,
        valor_pago: valorPago,
        forma_pagamento: gateway,
        data_pagamento: parsed.paidAt,
        observacoes: "Pago via gateway webhook",
        tenant_id: parcela.tenant_id,
      });

    if (insertErr) {
      console.error("[webhook-cobranca] Insert pagamento error:", insertErr.message);
    }

    // Check if all parcelas are paid → update recebimento
    const { count } = await supabase
      .from("parcelas")
      .select("*", { count: "exact", head: true })
      .eq("recebimento_id", parcela.recebimento_id)
      .neq("status", "paga");

    if ((count ?? 0) === 0) {
      await supabase
        .from("recebimentos")
        .update({ status: "pago" })
        .eq("id", parcela.recebimento_id);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[webhook-cobranca] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
