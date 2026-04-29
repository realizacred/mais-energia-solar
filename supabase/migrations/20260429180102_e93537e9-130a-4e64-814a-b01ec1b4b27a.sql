-- ─── B2.1: Coluna is_default ────────────────────────────────────────────────
ALTER TABLE public.proposta_templates
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposta_templates_default_per_grupo
  ON public.proposta_templates (tenant_id, grupo)
  WHERE is_default = true;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id, grupo 
           ORDER BY ativo DESC, ordem ASC, created_at ASC
         ) AS rn
  FROM public.proposta_templates
  WHERE ativo = true
)
UPDATE public.proposta_templates t
SET is_default = true
FROM ranked r
WHERE t.id = r.id AND r.rn = 1;

-- ─── B2.2: Backfill template_id_used ────────────────────────────────────────
UPDATE public.proposta_versoes pv
SET template_id_used = t.id
FROM public.proposta_templates t
WHERE pv.template_id_used IS NULL
  AND t.tenant_id = pv.tenant_id
  AND t.is_default = true
  AND t.grupo = COALESCE(
    NULLIF(pv.snapshot->>'grupo', ''),
    NULLIF(pv.final_snapshot->>'grupo', ''),
    'B'
  );

-- Fallback: qualquer default do tenant
UPDATE public.proposta_versoes pv
SET template_id_used = sub.id
FROM (
  SELECT DISTINCT ON (tenant_id) id, tenant_id
  FROM public.proposta_templates
  WHERE is_default = true
  ORDER BY tenant_id, grupo
) sub
WHERE pv.template_id_used IS NULL
  AND sub.tenant_id = pv.tenant_id;

-- ─── B1: Backfill public_slug + tokens (com fallback de validade) ───────────
DO $$
DECLARE
  v_record RECORD;
  v_token uuid;
  v_existing_token uuid;
  v_expires timestamptz;
BEGIN
  FOR v_record IN 
    SELECT id, proposta_id, tenant_id, valido_ate
    FROM public.proposta_versoes
    WHERE public_slug IS NULL
  LOOP
    SELECT token INTO v_existing_token
    FROM public.proposta_aceite_tokens
    WHERE versao_id = v_record.id 
      AND tipo = 'public'
      AND invalidado_em IS NULL
    LIMIT 1;

    IF v_existing_token IS NOT NULL THEN
      v_token := v_existing_token;
    ELSE
      v_token := gen_random_uuid();
      v_expires := COALESCE(v_record.valido_ate, now() + interval '90 days');
      INSERT INTO public.proposta_aceite_tokens (
        token, proposta_id, versao_id, tenant_id, tipo, expires_at
      ) VALUES (
        v_token, v_record.proposta_id, v_record.id, v_record.tenant_id, 
        'public', v_expires
      );
    END IF;

    UPDATE public.proposta_versoes
    SET public_slug = v_token::text
    WHERE id = v_record.id;
  END LOOP;
END $$;