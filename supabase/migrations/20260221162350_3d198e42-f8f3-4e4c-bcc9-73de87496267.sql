
-- =========================================
-- EXCLUSÃO DEFINITIVA: Enel GO + Elektro
-- Auditoria: 0 dependências em todas as FKs
-- =========================================

-- 1. Remove tarifas órfãs (já desativadas)
DELETE FROM public.concessionaria_tarifas_subgrupo 
WHERE concessionaria_id IN (
  '648e3f86-566a-4662-98c4-10c7bcbb801b',  -- Enel GO
  'fcbf7a73-f586-4910-9bc3-e1757eadc835'   -- Elektro
);

-- 2. Remove aliases órfãos
DELETE FROM public.concessionaria_aneel_aliases 
WHERE concessionaria_id IN (
  '648e3f86-566a-4662-98c4-10c7bcbb801b',
  'fcbf7a73-f586-4910-9bc3-e1757eadc835'
);

-- 3. Remove as concessionárias
DELETE FROM public.concessionarias 
WHERE id IN (
  '648e3f86-566a-4662-98c4-10c7bcbb801b',  -- Enel GO (incorporada por Equatorial GO)
  'fcbf7a73-f586-4910-9bc3-e1757eadc835'   -- Elektro (duplicata de Neoenergia Elektro)
);
