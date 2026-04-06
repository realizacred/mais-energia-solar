CREATE OR REPLACE FUNCTION public.normalize_proposta_versao_snapshot_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.snapshot := public.normalize_proposta_snapshot(NEW.snapshot);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_proposta_versao_snapshot ON public.proposta_versoes;

CREATE TRIGGER trg_normalize_proposta_versao_snapshot
BEFORE INSERT OR UPDATE OF snapshot
ON public.proposta_versoes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_proposta_versao_snapshot_trigger();