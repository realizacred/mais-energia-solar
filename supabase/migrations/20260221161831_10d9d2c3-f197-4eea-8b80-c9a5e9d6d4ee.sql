
-- Preencher PIS e COFINS padrão para todas as concessionárias ativas que não possuem
UPDATE public.concessionarias 
SET 
  pis_percentual = 1.65,
  cofins_percentual = 7.60,
  updated_at = now()
WHERE ativo = true 
  AND (pis_percentual IS NULL OR cofins_percentual IS NULL);
