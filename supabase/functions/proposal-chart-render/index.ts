/**
 * Edge Function: proposal-chart-render
 * Renders chart configurations as PNG images using QuickChart.io API.
 * With timeout (10s) and retry (2 attempts).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, fetchWithTimeout, sanitizeError } from "../_shared/error-utils.ts";

// 1x1 transparent PNG placeholder (base64)
const PLACEHOLDER_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

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
      return jsonResponse({ success: false, error: "Não autorizado" }, 401);
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      return jsonResponse({ success: false, error: "Sessão expirada" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) {
      return jsonResponse({ success: false, error: "Sem tenant" }, 403);
    }

    // ── 2. PARSE BODY ───────────────────────────────────────
    const body = await req.json();
    const { chart_config, dataset } = body;

    if (!chart_config || !dataset) {
      return jsonResponse({ success: false, error: "chart_config e dataset são obrigatórios" }, 400);
    }

    // ── 3. BUILD CHART.JS CONFIG ────────────────────────────
    const chartJsType = mapChartType(chart_config.chart_type);
    const quickChartConfig = {
      type: chartJsType,
      data: {
        labels: dataset.labels,
        datasets: dataset.datasets.map((ds: any) => ({
          label: ds.label ?? "",
          data: ds.data,
          backgroundColor: ds.backgroundColor ?? "#3b82f6",
          borderColor: ds.borderColor ?? "transparent",
          borderWidth: ds.borderWidth ?? 0,
          borderRadius: chartJsType === "bar" ? 4 : undefined,
        })),
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          title: {
            display: !!chart_config.title,
            text: chart_config.title ?? "",
            font: { size: 22, weight: "bold", family: "Inter, sans-serif" },
            color: "#1f2937",
            padding: { bottom: chart_config.subtitle ? 4 : 16 },
          },
          subtitle: {
            display: !!chart_config.subtitle,
            text: chart_config.subtitle ?? "",
            font: { size: 14, family: "Inter, sans-serif" },
            color: "#6b7280",
            padding: { bottom: 16 },
          },
          legend: {
            display: chart_config.show_legend ?? true,
            position: "bottom" as const,
            labels: {
              font: { size: 12, family: "Inter, sans-serif" },
              color: "#374151",
              padding: 16,
              usePointStyle: true,
            },
          },
          datalabels: chart_config.show_labels
            ? {
                display: true,
                color: "#374151",
                font: { size: 11, weight: "bold", family: "Inter, sans-serif" },
                anchor: "end" as const,
                align: "top" as const,
                formatter: (value: number) => {
                  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  return value.toLocaleString("pt-BR");
                },
              }
            : { display: false },
        },
        scales:
          chartJsType === "pie" || chartJsType === "doughnut"
            ? undefined
            : {
                x: {
                  grid: { display: chart_config.show_grid ?? true, color: "#e5e7eb" },
                  ticks: { font: { size: 11, family: "Inter, sans-serif" }, color: "#6b7280" },
                },
                y: {
                  grid: { display: chart_config.show_grid ?? true, color: "#e5e7eb" },
                  ticks: { font: { size: 11, family: "Inter, sans-serif" }, color: "#6b7280" },
                  beginAtZero: true,
                },
              },
      },
    };

    // ── 4. CALL QUICKCHART with timeout + retry ─────────────
    const width = chart_config.width ?? 1600;
    const height = chart_config.height ?? 900;

    const quickChartUrl = "https://quickchart.io/chart";
    const quickChartPayload = {
      chart: JSON.stringify(quickChartConfig),
      width,
      height,
      backgroundColor: "#ffffff",
      format: "png",
      devicePixelRatio: 2,
    };

    console.log(`[proposal-chart-render] Rendering ${chart_config.chart_type} chart (${width}x${height})`);

    let chartResponse: Response;
    try {
      chartResponse = await withRetry(
        async () => {
          const res = await fetchWithTimeout(
            quickChartUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(quickChartPayload),
            },
            10000, // 10s timeout
          );
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`QuickChart ${res.status}: ${errText}`);
          }
          return res;
        },
        {
          maxRetries: 1, // 2 total attempts
          baseDelayMs: 1000,
          onRetry: (attempt, err) => {
            console.warn(`[proposal-chart-render] Retry ${attempt}: ${sanitizeError(err)}`);
          },
        },
      );
    } catch (chartErr) {
      console.error(`[proposal-chart-render] QuickChart failed after retries: ${sanitizeError(chartErr)}`);
      // Fallback: return placeholder image
      console.log("[proposal-chart-render] Returning placeholder image");
      return jsonResponse({
        success: true,
        image_base64: PLACEHOLDER_PNG_B64,
        content_type: "image/png",
        size_bytes: 68,
        fallback: true,
        fallback_reason: sanitizeError(chartErr),
      });
    }

    // ── 5. RETURN BASE64 PNG ────────────────────────────────
    const arrayBuffer = await chartResponse.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    console.log(`[proposal-chart-render] Success — ${(uint8.length / 1024).toFixed(1)} KB`);

    return jsonResponse({
      success: true,
      image_base64: base64,
      content_type: "image/png",
      size_bytes: uint8.length,
    });
  } catch (err: any) {
    console.error("[proposal-chart-render] Error:", err);
    return jsonResponse({ success: false, error: sanitizeError(err) }, 500);
  }
});

function mapChartType(type: string): string {
  switch (type) {
    case "area":
      return "line";
    case "stacked_bar":
      return "bar";
    default:
      return type;
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
