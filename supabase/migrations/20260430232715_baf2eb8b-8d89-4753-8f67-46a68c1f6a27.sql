-- Split trg_proposta_versao_public_token into two triggers:
--   BEFORE INSERT: create public token + set public_slug (needs to mutate NEW)
--   AFTER  INSERT: mark previous versions as superseded (needs NEW.id to exist for FK)
--
-- Root cause: the original BEFORE INSERT trigger updated other rows
-- with substituida_por = NEW.id, but NEW.id did not yet exist in
-- proposta_versoes, violating proposta_versoes_substituida_por_fkey.

-- 1) Replace BEFORE INSERT function: only token creation + public_slug
CREATE OR REPLACE FUNCTION public.trg_proposta_versao_public_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token uuid;
BEGIN
  -- Skip if the inserter already provided a public_slug (idempotency / migrations)
  IF NEW.public_slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Create the public token for this version (no expires_at)
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

  -- Mirror token into versão.public_slug
  NEW.public_slug := v_token::text;

  RETURN NEW;
END;
$function$;

-- 2) New AFTER INSERT function: invalidate prior tokens + mark prior versions
CREATE OR REPLACE FUNCTION public.trg_proposta_versao_supersede_prior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Invalidate prior tokens of OLDER versions of the same proposta
  UPDATE public.proposta_aceite_tokens
     SET invalidado_em = COALESCE(invalidado_em, now()),
         motivo_invalidacao = COALESCE(motivo_invalidacao,
                                       'Substituída por nova versão da proposta')
   WHERE proposta_id = NEW.proposta_id
     AND versao_id <> NEW.id
     AND invalidado_em IS NULL;

  -- Mark previous versions as superseded (audit trail)
  -- Safe now: NEW.id already exists in proposta_versoes (AFTER INSERT)
  UPDATE public.proposta_versoes
     SET substituida_em = COALESCE(substituida_em, now()),
         substituida_por = COALESCE(substituida_por, NEW.id)
   WHERE proposta_id = NEW.proposta_id
     AND id <> NEW.id
     AND substituida_em IS NULL;

  RETURN NEW;
END;
$function$;

-- 3) Attach the AFTER INSERT trigger
DROP TRIGGER IF EXISTS trg_proposta_versao_supersede_prior ON public.proposta_versoes;
CREATE TRIGGER trg_proposta_versao_supersede_prior
  AFTER INSERT ON public.proposta_versoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proposta_versao_supersede_prior();