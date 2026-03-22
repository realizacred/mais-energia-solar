CREATE OR REPLACE FUNCTION public.get_invoice_kpis(
  p_tenant_id uuid,
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_faturas', COUNT(*)::int,
    'total_valor', COALESCE(SUM(total_amount), 0),
    'total_kwh', COALESCE(SUM(energy_consumed_kwh), 0),
    'total_injetado_kwh', COALESCE(SUM(energy_injected_kwh), 0),
    'media_valor', COALESCE(AVG(total_amount), 0),
    'faturas_pendentes', COUNT(*) FILTER (WHERE parsing_status = 'pending')::int,
    'faturas_erro', COUNT(*) FILTER (WHERE parsing_status = 'error')::int
  )
  FROM unit_invoices
  WHERE tenant_id = p_tenant_id
    AND (p_year IS NULL OR reference_year = p_year)
    AND (p_month IS NULL OR reference_month = p_month);
$$;