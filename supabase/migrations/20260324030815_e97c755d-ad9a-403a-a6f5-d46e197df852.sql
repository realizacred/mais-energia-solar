-- RPC to get GD group data for a UC via public token
-- Returns: group info, beneficiaries with UC names, latest invoices for each UC
CREATE OR REPLACE FUNCTION public.resolve_uc_gd_data(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok uc_client_tokens%ROWTYPE;
  v_uc units_consumidoras%ROWTYPE;
  v_group gd_groups%ROWTYPE;
  v_beneficiaries JSON;
  v_gen_invoices JSON;
  v_tarifa NUMERIC;
BEGIN
  -- Validate token
  SELECT * INTO v_tok FROM uc_client_tokens
  WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN json_build_object('error', 'invalid_token'); END IF;

  -- Get UC
  SELECT * INTO v_uc FROM units_consumidoras WHERE id = v_tok.unit_id;

  -- Find active GD group where this UC is geradora OR beneficiaria
  -- First check if UC is geradora
  SELECT * INTO v_group FROM gd_groups
  WHERE uc_geradora_id = v_uc.id AND status = 'active'
  LIMIT 1;

  -- If not geradora, check if UC is a beneficiaria
  IF NOT FOUND THEN
    SELECT g.* INTO v_group FROM gd_groups g
    JOIN gd_group_beneficiaries b ON b.gd_group_id = g.id
    WHERE b.uc_beneficiaria_id = v_uc.id AND b.is_active = true AND g.status = 'active'
    LIMIT 1;
  END IF;

  -- No GD group found
  IF NOT FOUND THEN
    RETURN json_build_object('has_gd', false);
  END IF;

  -- Get beneficiaries with UC names and latest invoice data
  SELECT COALESCE(json_agg(row_to_json(ben)), '[]'::json) INTO v_beneficiaries
  FROM (
    SELECT
      gb.uc_beneficiaria_id AS uc_id,
      uc.nome AS uc_name,
      uc.codigo_uc,
      gb.allocation_percent,
      gb.priority_order,
      (
        SELECT json_build_object(
          'consumed_kwh', COALESCE(inv.energy_consumed_kwh, 0),
          'compensated_kwh', COALESCE(inv.compensated_kwh, 0),
          'injected_kwh', COALESCE(inv.energy_injected_kwh, 0),
          'total_amount', COALESCE(inv.total_amount, 0),
          'savings_brl', COALESCE(inv.estimated_savings_brl, 0),
          'balance_kwh', COALESCE(inv.current_balance_kwh, 0),
          'ref_year', inv.reference_year,
          'ref_month', inv.reference_month
        )
        FROM unit_invoices inv
        WHERE inv.unit_id = gb.uc_beneficiaria_id
        ORDER BY inv.reference_year DESC, inv.reference_month DESC
        LIMIT 1
      ) AS latest_invoice,
      -- 3 month average consumption
      (
        SELECT COALESCE(AVG(inv2.energy_consumed_kwh), 0)
        FROM unit_invoices inv2
        WHERE inv2.unit_id = gb.uc_beneficiaria_id
        ORDER BY inv2.reference_year DESC, inv2.reference_month DESC
        LIMIT 3
      ) AS avg_consumed_kwh
    FROM gd_group_beneficiaries gb
    JOIN units_consumidoras uc ON uc.id = gb.uc_beneficiaria_id
    WHERE gb.gd_group_id = v_group.id AND gb.is_active = true
    ORDER BY gb.priority_order NULLS LAST, uc.nome
  ) ben;

  -- Get geradora UC name and latest invoice
  SELECT COALESCE(json_agg(row_to_json(gi)), '[]'::json) INTO v_gen_invoices
  FROM (
    SELECT
      inv.energy_consumed_kwh AS consumed_kwh,
      inv.energy_injected_kwh AS injected_kwh,
      inv.compensated_kwh,
      inv.total_amount,
      inv.estimated_savings_brl AS savings_brl,
      inv.current_balance_kwh AS balance_kwh,
      inv.reference_year AS ref_year,
      inv.reference_month AS ref_month
    FROM unit_invoices inv
    WHERE inv.unit_id = v_group.uc_geradora_id
    ORDER BY inv.reference_year DESC, inv.reference_month DESC
    LIMIT 3
  ) gi;

  -- Get tarifa
  SELECT tarifa_media_kwh INTO v_tarifa
  FROM calculadora_config WHERE tenant_id = v_tok.tenant_id LIMIT 1;

  RETURN json_build_object(
    'has_gd', true,
    'group_id', v_group.id,
    'group_name', v_group.nome,
    'categoria_gd', v_group.categoria_gd,
    'uc_geradora_id', v_group.uc_geradora_id,
    'uc_geradora_name', (SELECT nome FROM units_consumidoras WHERE id = v_group.uc_geradora_id),
    'uc_geradora_codigo', (SELECT codigo_uc FROM units_consumidoras WHERE id = v_group.uc_geradora_id),
    'beneficiaries', v_beneficiaries,
    'geradora_invoices', v_gen_invoices,
    'tarifa_kwh', COALESCE(v_tarifa, 0.85),
    'current_uc_role', CASE
      WHEN v_uc.id = v_group.uc_geradora_id THEN 'geradora'
      ELSE 'beneficiaria'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_uc_gd_data(TEXT) TO anon;