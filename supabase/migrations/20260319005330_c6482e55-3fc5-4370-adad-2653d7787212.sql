-- RPC to calculate monthly AI cost per tenant (in USD)
CREATE OR REPLACE FUNCTION public.calcular_custo_ia_mes(p_tenant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM ai_usage_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('month', now());
$$;