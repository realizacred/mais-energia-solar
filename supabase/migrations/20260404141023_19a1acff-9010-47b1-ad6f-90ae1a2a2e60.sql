-- Add origem column to projetos, clientes, deals
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS origem text DEFAULT 'native';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS origem text DEFAULT 'native';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS origem text DEFAULT 'native';

-- Mark existing imported records
UPDATE projetos SET origem = 'imported' WHERE codigo LIKE 'PROJ-SM-%';
UPDATE propostas_nativas SET origem = 'imported' WHERE sm_id IS NOT NULL;
UPDATE deals SET origem = 'imported' WHERE legacy_key LIKE 'sm:%';
UPDATE clientes SET origem = 'imported' WHERE cliente_code LIKE 'SM-%';

-- Fix reset_migrated_data to only delete imported data
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_propostas int;
  v_versoes int;
  v_projetos int;
  v_deals int;
  v_clientes int;
BEGIN
  -- Delete proposta_versoes of imported propostas
  DELETE FROM proposta_versoes
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas
    WHERE tenant_id = p_tenant_id AND origem = 'imported'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- Delete imported propostas
  DELETE FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- Delete imported deals
  DELETE FROM deals
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- Delete imported projetos
  DELETE FROM projetos
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- Delete imported clientes that have no native projetos
  DELETE FROM clientes
  WHERE tenant_id = p_tenant_id
    AND origem = 'imported'
    AND NOT EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.cliente_id = clientes.id AND p.origem = 'native'
    );
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  -- Reset SM migration flags
  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'propostas_nativas', v_propostas,
    'proposta_versoes', v_versoes,
    'projetos', v_projetos,
    'deals', v_deals,
    'clientes', v_clientes
  );
END;
$$;