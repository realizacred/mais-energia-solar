-- Passo 2: normalizar valores inválidos
UPDATE proposta_versoes SET
  tir = NULL,
  payback_meses = NULL
WHERE id IN (
  'ed218519-3ae3-4ddc-8d8e-9300bcff6e4d',
  '60d1c263-d3de-417d-a676-0108fd424375',
  'aabe377c-456c-44a1-8252-5fc95cf91dfa',
  '564866d3-5d81-4ea7-adfd-bf0149ddb36c',
  '6501a796-c4d1-4af2-8a35-a4cb6d953a74',
  '70f54429-43a7-4b09-80b8-db4ab78101b1'
)
AND COALESCE(snapshot->>'origem','') != 'solarmarket'
AND (
  (tir IS NOT NULL AND (tir < 0 OR tir > 100))
  OR (payback_meses IS NOT NULL AND (payback_meses < 12 OR payback_meses > 360))
);

-- Passo 4: trigger passa a bloquear valores absurdos (apenas não-SM)
CREATE OR REPLACE FUNCTION public.fn_proposta_versao_financial_sanity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.snapshot->>'origem','') != 'solarmarket' THEN
    IF NEW.tir IS NOT NULL AND (NEW.tir < 0 OR NEW.tir > 100) THEN
      RAISE EXCEPTION 'TIR inválida: % (deve estar entre 0 e 100)', NEW.tir;
    END IF;
    IF NEW.payback_meses IS NOT NULL AND (NEW.payback_meses < 12 OR NEW.payback_meses > 360) THEN
      RAISE EXCEPTION 'Payback inválido: % meses (deve estar entre 12 e 360)', NEW.payback_meses;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;