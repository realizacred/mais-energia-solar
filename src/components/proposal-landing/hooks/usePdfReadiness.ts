import { useQuery } from "@tanstack/react-query";

export type PdfReadiness =
  | { status: "ready"; url: string }
  | { status: "generating"; message?: string }
  | { status: "failed"; message?: string };

/**
 * Sonda a Edge Function `proposal-pdf-serve` checando o `content-type`
 * da resposta para determinar se o PDF está pronto para ser renderizado
 * em um iframe. Nunca renderiza JSON técnico — apenas retorna estado.
 *
 * Retry exponencial via React Query (cap 8s) enquanto status = generating.
 * Para automaticamente quando ready/failed. Cleanup automático no unmount.
 */
export function usePdfReadiness(token: string | undefined, enabled = true) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const url = token
    ? `${supabaseUrl}/functions/v1/proposal-pdf-serve?token=${encodeURIComponent(token)}`
    : "";

  return useQuery<PdfReadiness>({
    queryKey: ["pdf-readiness", token],
    enabled: Boolean(token) && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 2000;
      if (data.status === "generating") {
        // exponencial leve: 2s, 3s, 5s, 8s (cap)
        const attempt = Math.min(q.state.dataUpdateCount, 4);
        return [2000, 3000, 5000, 8000][attempt - 1] ?? 8000;
      }
      return false; // stop on ready/failed
    },
    queryFn: async () => {
      try {
        // GET com Range mínimo para evitar baixar PDF inteiro só na sonda.
        const resp = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
        });
        const ct = (resp.headers.get("content-type") || "").toLowerCase();

        if (resp.ok && ct.includes("application/pdf")) {
          return { status: "ready", url };
        }

        // Resposta JSON ({status:"generating"|"failed",...})
        if (ct.includes("application/json")) {
          let payload: any = null;
          try { payload = await resp.json(); } catch { /* ignore */ }
          const remote = String(payload?.status || "").toLowerCase();
          if (remote === "failed") {
            return { status: "failed", message: payload?.message };
          }
          return { status: "generating", message: payload?.message };
        }

        // Qualquer outra coisa = continuar sondando como generating.
        return { status: "generating" };
      } catch {
        return { status: "generating" };
      }
    },
  });
}
