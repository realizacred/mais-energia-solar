-- FASE 3.1: Corrigir TIR
WITH tir_fix AS (
  UPDATE public.proposta_versoes pv
  SET tir = ROUND((tir * 100)::numeric, 2)
  FROM public.propostas_nativas pn
  WHERE pn.id = pv.proposta_id
    AND pn.external_source = 'solarmarket'
    AND pv.tir > 0 AND pv.tir < 1
  RETURNING pv.id, pn.tenant_id, pv.tir AS tir_after
)
INSERT INTO public.wave2_financial_fix_log (tenant_id, versao_id, fix_type, after_value, details)
SELECT tenant_id, id, 'tir_decimal_to_percent', tir_after, jsonb_build_object('source','solarmarket')
FROM tir_fix;

-- FASE 3.2: Corrigir Payback
WITH payback_fix AS (
  UPDATE public.proposta_versoes pv
  SET payback_meses = payback_meses * 12
  FROM public.propostas_nativas pn
  WHERE pn.id = pv.proposta_id
    AND pn.external_source = 'solarmarket'
    AND pv.payback_meses BETWEEN 1 AND 11
  RETURNING pv.id, pn.tenant_id, pv.payback_meses AS payback_after
)
INSERT INTO public.wave2_financial_fix_log (tenant_id, versao_id, fix_type, after_value, details)
SELECT tenant_id, id, 'payback_years_to_months', payback_after, jsonb_build_object('source','solarmarket')
FROM payback_fix;

-- FASE 7: Sanity guard (alerta-only)
CREATE OR REPLACE FUNCTION public.tg_proposta_versao_financial_sanity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.tir IS NOT NULL AND (NEW.tir < 0 OR NEW.tir > 100))
     OR (NEW.payback_meses IS NOT NULL AND NEW.payback_meses > 0
         AND (NEW.payback_meses < 12 OR NEW.payback_meses > 360)) THEN
    BEGIN
      INSERT INTO public.wave2_financial_fix_log (tenant_id, versao_id, fix_type, details)
      VALUES (NEW.tenant_id, NEW.id, 'sanity_alert',
        jsonb_build_object('tir', NEW.tir, 'payback_meses', NEW.payback_meses,
          'reason','out_of_expected_range'));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposta_versao_financial_sanity ON public.proposta_versoes;
CREATE TRIGGER trg_proposta_versao_financial_sanity
  AFTER INSERT OR UPDATE OF tir, payback_meses ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_proposta_versao_financial_sanity();