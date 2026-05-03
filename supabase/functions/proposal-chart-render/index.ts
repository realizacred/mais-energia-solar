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
    const isPie = chartJsType === "pie" || chartJsType === "doughnut";
    const isArea = chart_config.chart_type === "area";
    const palette: string[] =
      Array.isArray(chart_config.colors) && chart_config.colors.length
        ? chart_config.colors
        : ["#FF6A00", "#144C8C", "#3F6FCC", "#16A34A", "#F59E0B", "#64748B"];

    const quickChartConfig = {
      type: chartJsType,
      data: {
        labels: dataset.labels,
        datasets: dataset.datasets.map((ds: any, dsIdx: number) => {
          // For pie/doughnut: spread palette across slices
          // For bar single-series: use first palette color (or per-bar if 1 dataset)
          const baseColor = palette[dsIdx % palette.length];
          const bg = isPie
            ? dataset.labels.map((_: unknown, i: number) => palette[i % palette.length])
            : ds.backgroundColor ?? baseColor;
          return {
            label: ds.label ?? "",
            data: ds.data,
            backgroundColor: isArea ? hexToRgba(baseColor, 0.18) : bg,
            borderColor: ds.borderColor ?? (isArea || chartJsType === "line" ? baseColor : "transparent"),
            borderWidth: ds.borderWidth ?? (chartJsType === "line" || isArea ? 3 : 0),
            borderRadius: chartJsType === "bar" ? 6 : undefined,
            tension: chartJsType === "line" || isArea ? 0.35 : undefined,
            fill: isArea ? true : undefined,
            pointRadius: chartJsType === "line" || isArea ? 3 : undefined,
            pointBackgroundColor: baseColor,
          };
        }),
      },
      options: {
        responsive: false,
        animation: false,
        layout: { padding: { top: 24, right: 24, bottom: 16, left: 16 } },
        plugins: {
          title: {
            display: !!chart_config.title,
            text: chart_config.title ?? "",
            font: { size: 26, weight: "bold", family: "Inter, sans-serif" },
            color: "#0F172A",
            padding: { bottom: chart_config.subtitle ? 4 : 20 },
          },
          subtitle: {
            display: !!chart_config.subtitle,
            text: chart_config.subtitle ?? "",
            font: { size: 15, family: "Inter, sans-serif" },
            color: "#64748B",
            padding: { bottom: 20 },
          },
          legend: {
            display: chart_config.show_legend ?? true,
            position: "bottom" as const,
            labels: {
              font: { size: 13, family: "Inter, sans-serif" },
              color: "#334155",
              padding: 18,
              usePointStyle: true,
              boxWidth: 8,
              boxHeight: 8,
            },
          },
          datalabels: chart_config.show_labels
            ? {
                display: true,
                color: isPie ? "#FFFFFF" : "#1E293B",
                font: { size: 12, weight: "600", family: "Inter, sans-serif" },
                anchor: isPie ? "center" : ("end" as const),
                align: isPie ? "center" : ("top" as const),
                formatter: (value: number) => {
                  if (value === 0) return "";
                  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                },
              }
            : { display: false },
        },
        scales: isPie
          ? undefined
          : {
              x: {
                grid: { display: false },
                ticks: { font: { size: 12, family: "Inter, sans-serif" }, color: "#64748B" },
              },
              y: {
                grid: {
                  display: chart_config.show_grid ?? true,
                  color: "#E2E8F0",
                  drawBorder: false,
                },
                ticks: {
                  font: { size: 12, family: "Inter, sans-serif" },
                  color: "#64748B",
                  callback: function (value: any) {
                    const n = Number(value);
                    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
                    return n.toLocaleString("pt-BR");
                  },
                },
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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
