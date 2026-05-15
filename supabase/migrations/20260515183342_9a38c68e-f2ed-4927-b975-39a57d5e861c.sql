-- 1. Add columns for Draft vs Official management
ALTER TABLE public.propostas_nativas 
ADD COLUMN IF NOT EXISTS draft_total NUMERIC,
ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN DEFAULT FALSE;

ALTER TABLE public.proposta_versoes 
ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;

-- 2. Initialize official flag based on current version logic
-- Use correct enum value 'generated'
UPDATE public.proposta_versoes
SET is_official = TRUE
WHERE id IN (
    SELECT v.id 
    FROM public.proposta_versoes v
    JOIN public.propostas_nativas p ON v.proposta_id = p.id
    WHERE v.status = 'generated'::public.proposta_nativa_status
    ORDER BY v.versao_numero DESC
    LIMIT 1
);

-- 3. Create or Update synchronization function (SSOT)
CREATE OR REPLACE FUNCTION public.sync_proposal_value_to_crm()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_id UUID;
    v_projeto_id UUID;
BEGIN
    -- Only sync if it's the official version (is_official = true)
    IF NEW.is_official = TRUE THEN
        -- Resolve Deal and Project IDs from the Proposal
        SELECT deal_id, projeto_id INTO v_deal_id, v_projeto_id
        FROM public.propostas_nativas
        WHERE id = NEW.proposta_id;

        -- Update Deal if exists
        IF v_deal_id IS NOT NULL THEN
            UPDATE public.deals
            SET value = NEW.valor_total,
                kwp = NEW.potencia_kwp,
                updated_at = NOW()
            WHERE id = v_deal_id;
        END IF;

        -- Update Project if exists
        IF v_projeto_id IS NOT NULL THEN
            UPDATE public.projetos
            SET valor_total = NEW.valor_total,
                potencia_kwp = NEW.potencia_kwp,
                updated_at = NOW()
            WHERE id = v_projeto_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to sync values whenever a version becomes official
DROP TRIGGER IF EXISTS tr_sync_proposal_value ON public.proposta_versoes;
CREATE TRIGGER tr_sync_proposal_value
AFTER INSERT OR UPDATE OF is_official, valor_total ON public.proposta_versoes
FOR EACH ROW
WHEN (NEW.is_official = TRUE)
EXECUTE FUNCTION public.sync_proposal_value_to_crm();

-- 5. Enhanced proposal_create_version to handle draft tracking
CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id uuid,
  p_versao_id uuid DEFAULT NULL::uuid,
  p_snapshot jsonb DEFAULT NULL::jsonb,
  p_potencia_kwp numeric DEFAULT NULL::numeric,
  p_valor_total numeric DEFAULT NULL::numeric,
  p_economia_mensal numeric DEFAULT NULL::numeric,
  p_geracao_mensal numeric DEFAULT NULL::numeric,
  p_grupo text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_calc_hash text DEFAULT NULL::text,
  p_engine_version text DEFAULT NULL::text,
  p_validade_dias integer DEFAULT 30,
  p_observacoes text DEFAULT NULL::text,
  p_gerado_por uuid DEFAULT NULL::uuid,
  p_payback_meses integer DEFAULT NULL::integer,
  p_intent text DEFAULT 'draft'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_versao_id uuid;
  v_versao_num integer;
  v_is_active boolean;
  v_result jsonb;
BEGIN
  v_is_active := (p_intent = 'active');

  -- Update draft status on the main proposal table
  UPDATE public.propostas_nativas
  SET draft_total = p_valor_total,
      has_unpublished_changes = CASE WHEN v_is_active THEN FALSE ELSE TRUE END,
      updated_at = NOW()
  WHERE id = p_proposta_id;

  IF v_is_active THEN
      -- Mark all other versions of this proposal as not official
      UPDATE public.proposta_versoes
      SET is_official = FALSE
      WHERE proposta_id = p_proposta_id;
  END IF;

  -- Create the new version
  INSERT INTO public.proposta_versoes (
    proposta_id,
    versao_numero,
    snapshot,
    potencia_kwp,
    valor_total,
    economia_mensal,
    geracao_mensal,
    grupo,
    idempotency_key,
    calc_hash,
    engine_version,
    valid_until,
    observacoes,
    gerado_por,
    payback_meses,
    status,
    is_official
  )
  SELECT
    p_proposta_id,
    COALESCE((SELECT MAX(versao_numero) FROM public.proposta_versoes WHERE proposta_id = p_proposta_id), 0) + 1,
    p_snapshot,
    p_potencia_kwp,
    p_valor_total,
    p_economia_mensal,
    p_geracao_mensal,
    p_grupo,
    p_idempotency_key,
    p_calc_hash,
    p_engine_version,
    NOW() + (p_validade_dias || ' days')::interval,
    p_observacoes,
    p_gerado_por,
    p_payback_meses,
    CASE WHEN v_is_active THEN 'generated'::public.proposta_nativa_status ELSE 'draft'::public.proposta_nativa_status END,
    v_is_active
  RETURNING id INTO v_new_versao_id;

  -- If active, update the main proposal's status
  IF v_is_active THEN
      UPDATE public.propostas_nativas
      SET status = 'generated'::public.proposta_nativa_status
      WHERE id = p_proposta_id;
  END IF;

  v_result := jsonb_build_object(
    'versao_id', v_new_versao_id,
    'proposta_id', p_proposta_id,
    'intent', p_intent,
    'is_official', v_is_active
  );

  RETURN v_result;
END;
$$;