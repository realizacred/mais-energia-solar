import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIUsageLog {
  id: string;
  tenant_id: string;
  user_id: string;
  function_name: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  is_fallback: boolean;
  created_at: string;
}

export interface AIUsageSummary {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  by_provider: Record<string, { requests: number; tokens: number; cost: number }>;
  by_function: Record<string, { requests: number; tokens: number; cost: number }>;
}

export function useAIUsageLogs(options?: {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const { limit = 100, startDate, endDate } = options || {};

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ["ai-usage-logs", limit, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (startDate) query = query.gte("created_at", startDate.toISOString());
      if (endDate) query = query.lte("created_at", endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AIUsageLog[];
    },
    staleTime: 1000 * 60 * 5, // dados normais — §23
  });

  const summary: AIUsageSummary = {
    total_requests: logs?.length || 0,
    total_tokens: logs?.reduce((s, l) => s + l.total_tokens, 0) || 0,
    total_cost_usd: logs?.reduce((s, l) => s + Number(l.estimated_cost_usd), 0) || 0,
    by_provider: {},
    by_function: {},
  };

  logs?.forEach((log) => {
    if (!summary.by_provider[log.provider]) {
      summary.by_provider[log.provider] = { requests: 0, tokens: 0, cost: 0 };
    }
    summary.by_provider[log.provider].requests++;
    summary.by_provider[log.provider].tokens += log.total_tokens;
    summary.by_provider[log.provider].cost += Number(log.estimated_cost_usd);

    if (!summary.by_function[log.function_name]) {
      summary.by_function[log.function_name] = { requests: 0, tokens: 0, cost: 0 };
    }
    summary.by_function[log.function_name].requests++;
    summary.by_function[log.function_name].tokens += log.total_tokens;
    summary.by_function[log.function_name].cost += Number(log.estimated_cost_usd);
  });

  return { logs, summary, isLoading, error, refetch };
}
