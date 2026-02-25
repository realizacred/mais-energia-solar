
-- ═══════════════════════════════════════════════════════════
-- PROPOSAL FINALIZATION: final_snapshot + clone + finalize RPCs
-- ═══════════════════════════════════════════════════════════

-- ─── A) Schema: add columns ────────────────────────────────

ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS final_snapshot JSONB NULL,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS public_slug TEXT NULL;

-- Unique index on public_slug (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposta_versoes_public_slug
  ON public.proposta_versoes (public_slug) WHERE public_slug IS NOT NULL;

-- ─── B) RPC: finalize_proposta_versao ──────────────────────
-- Locks the version, stores final_snapshot, generates public_slug.
-- The actual calculation is done by the Edge Function proposal-generate
-- BEFORE calling this RPC. This RPC just seals the result.

CREATE OR REPLACE FUNCTION public.finalize_proposta_versao(
  p_versao_id UUID,
  p_final_snapshot JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao RECORD;
  v_tenant_id UUID;
  v_slug TEXT;
  v_user_id UUID;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Get tenant
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE user_id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  -- Load version with tenant check
  SELECT * INTO v_versao
  FROM proposta_versoes
  WHERE id = p_versao_id AND tenant_id = v_tenant_id;

  IF v_versao IS NULL THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND';
  END IF;

  -- Already finalized? Return idempotent
  IF v_versao.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'versao_id', v_versao.id,
      'public_slug', v_versao.public_slug,
      'finalized_at', v_versao.finalized_at,
      'idempotent', true
    );
  END IF;

  -- Generate slug: short random string
  v_slug := v_versao.public_slug;
  IF v_slug IS NULL THEN
    v_slug := encode(gen_random_bytes(8), 'hex');
  END IF;

  -- Build final_snapshot from provided param or from existing snapshot
  -- The caller (Edge Function or frontend) should build the complete object
  UPDATE proposta_versoes SET
    final_snapshot = COALESCE(p_final_snapshot, snapshot),
    snapshot_locked = true,
    finalized_at = now(),
    public_slug = v_slug,
    status = 'generated',
    gerado_em = COALESCE(gerado_em, now()),
    gerado_por = COALESCE(gerado_por, v_user_id),
    updated_at = now()
  WHERE id = p_versao_id;

  -- Update parent proposta status
  UPDATE propostas_nativas SET
    status = 'gerada',
    updated_at = now()
  WHERE id = v_versao.proposta_id AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'versao_id', p_versao_id,
    'public_slug', v_slug,
    'finalized_at', now(),
    'idempotent', false
  );
END;
$$;

-- ─── C) RPC: clone_proposta_versao ─────────────────────────
-- Creates a new draft version by copying inputs from the source.

CREATE OR REPLACE FUNCTION public.clone_proposta_versao(
  p_from_versao_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_tenant_id UUID;
  v_user_id UUID;
  v_new_id UUID;
  v_next_num INT;
  v_input_snapshot JSONB;
BEGIN
  -- Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE user_id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  -- Load source
  SELECT * INTO v_source
  FROM proposta_versoes
  WHERE id = p_from_versao_id AND tenant_id = v_tenant_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'SOURCE_VERSION_NOT_FOUND';
  END IF;

  -- Extract inputs: prefer final_snapshot.inputs, fallback to snapshot
  IF v_source.final_snapshot IS NOT NULL AND v_source.final_snapshot ? 'inputs' THEN
    v_input_snapshot := v_source.final_snapshot -> 'inputs';
  ELSE
    v_input_snapshot := v_source.snapshot;
  END IF;

  -- Next version number
  SELECT COALESCE(MAX(versao_numero), 0) + 1 INTO v_next_num
  FROM proposta_versoes
  WHERE proposta_id = v_source.proposta_id;

  -- Insert new draft
  INSERT INTO proposta_versoes (
    tenant_id, proposta_id, versao_numero,
    status, grupo, potencia_kwp, valor_total,
    economia_mensal, geracao_mensal, payback_meses,
    snapshot, final_snapshot, snapshot_locked,
    finalized_at, public_slug,
    engine_version, validade_dias
  ) VALUES (
    v_tenant_id, v_source.proposta_id, v_next_num,
    'draft', v_source.grupo, v_source.potencia_kwp, v_source.valor_total,
    v_source.economia_mensal, v_source.geracao_mensal, v_source.payback_meses,
    v_input_snapshot, NULL, false,
    NULL, NULL,
    v_source.engine_version, v_source.validade_dias
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'new_versao_id', v_new_id,
    'proposta_id', v_source.proposta_id,
    'versao_numero', v_next_num,
    'cloned_from', p_from_versao_id
  );
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
