-- Backfill controlado: sincronizar colunas diretas com snapshot canônico.
-- SSOT: snapshot é fonte de verdade; colunas diretas são apenas cache derivado.
-- Não recalcula nada — apenas copia do snapshot já persistido.

UPDATE public.proposta_versoes pv
SET
  economia_mensal = COALESCE((pv.snapshot->>'economia_mensal')::numeric, pv.economia_mensal),
  payback_meses   = COALESCE((pv.snapshot->>'payback_meses')::numeric,   pv.payback_meses),
  tir             = COALESCE((pv.snapshot->>'tir')::numeric,             pv.tir),
  vpl             = COALESCE((pv.snapshot->>'vpl')::numeric,             pv.vpl)
WHERE pv.snapshot IS NOT NULL
  AND pv.snapshot <> '{}'::jsonb
  AND (
       ((pv.snapshot->>'economia_mensal') IS NOT NULL AND (pv.snapshot->>'economia_mensal')::numeric IS DISTINCT FROM pv.economia_mensal)
    OR ((pv.snapshot->>'payback_meses')   IS NOT NULL AND (pv.snapshot->>'payback_meses')::numeric   IS DISTINCT FROM pv.payback_meses)
    OR ((pv.snapshot->>'tir')             IS NOT NULL AND (pv.snapshot->>'tir')::numeric             IS DISTINCT FROM pv.tir)
    OR ((pv.snapshot->>'vpl')             IS NOT NULL AND (pv.snapshot->>'vpl')::numeric             IS DISTINCT FROM pv.vpl)
  );