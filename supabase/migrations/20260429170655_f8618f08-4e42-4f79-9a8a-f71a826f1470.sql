-- ═══════════════════════════════════════════════════════════════
-- QR / Public link automation for new proposal versions
-- Phase A — only affects versions created from now on
-- ═══════════════════════════════════════════════════════════════

-- 1) Trigger function: on new versão, create public token and
--    invalidate previous versions' tokens for the same proposta.
CREATE OR REPLACE FUNCTION public.trg_proposta_versao_public_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  -- Skip if the inserter already provided a public_slug (idempotency / migrations)
  IF NEW.public_slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1a. Invalidate any non-invalidated tokens of PREVIOUS versions of the
  --     same proposta. This effectively turns old QR/links into 404.
  --     Only affects sibling versions — current row is the new one.
  UPDATE public.proposta_aceite_tokens
     SET invalidado_em = COALESCE(invalidado_em, now()),
         motivo_invalidacao = COALESCE(motivo_invalidacao,
                                       'Substituída por nova versão da proposta')
   WHERE proposta_id = NEW.proposta_id
     AND versao_id <> NEW.id
     AND invalidado_em IS NULL;

  -- Mark previous versions as superseded (audit trail)
  UPDATE public.proposta_versoes
     SET substituida_em = COALESCE(substituida_em, now()),
         substituida_por = COALESCE(substituida_por, NEW.id)
   WHERE proposta_id = NEW.proposta_id
     AND id <> NEW.id
     AND substituida_em IS NULL;

  -- 1b. Create the public token for this version (no expires_at — never
  --     expires for now; invalidation happens only via new version)
  INSERT INTO public.proposta_aceite_tokens (
    tenant_id,
    proposta_id,
    versao_id,
    tipo,
    created_by
  )
  VALUES (
    NEW.tenant_id,
    NEW.proposta_id,
    NEW.id,
    'public',
    NEW.gerado_por
  )
  RETURNING token INTO v_token;

  -- 1c. Mirror token into versão.public_slug (already used by message
  --     generator and detail UI as the public link reference)
  NEW.public_slug := v_token::text;

  RETURN NEW;
END;
$$;

-- 2) Attach trigger BEFORE INSERT (so we can update NEW.public_slug)
DROP TRIGGER IF EXISTS trg_proposta_versao_public_token ON public.proposta_versoes;

CREATE TRIGGER trg_proposta_versao_public_token
BEFORE INSERT ON public.proposta_versoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_proposta_versao_public_token();

COMMENT ON FUNCTION public.trg_proposta_versao_public_token() IS
'Phase A — QR Code automation. On every new proposta_versoes insert: (1) creates a public-type token in proposta_aceite_tokens, (2) mirrors the token uuid into proposta_versoes.public_slug, (3) invalidates tokens of previous versions of the same proposta and marks them as substituída_em/substituída_por. Only affects versions created from this migration onwards (no backfill).';