
-- ============================================================
-- AUDITORIA: Desativar concessionárias duplicadas/obsoletas
-- ============================================================

-- 1. Desativar Enel Goiás (incorporada por Equatorial GO/CELG)
UPDATE public.concessionarias 
SET ativo = false, updated_at = now() 
WHERE id = '648e3f86-566a-4662-98c4-10c7bcbb801b';

-- Desativar tarifas órfãs da Enel GO
UPDATE public.concessionaria_tarifas_subgrupo 
SET is_active = false, updated_at = now() 
WHERE concessionaria_id = '648e3f86-566a-4662-98c4-10c7bcbb801b';

-- 2. Desativar Elektro (duplicata de Neoenergia Elektro)
UPDATE public.concessionarias 
SET ativo = false, updated_at = now() 
WHERE id = 'fcbf7a73-f586-4910-9bc3-e1757eadc835';

-- Desativar tarifas órfãs da Elektro
UPDATE public.concessionaria_tarifas_subgrupo 
SET is_active = false, updated_at = now() 
WHERE concessionaria_id = 'fcbf7a73-f586-4910-9bc3-e1757eadc835';

-- 3. Adicionar alias ANEEL para Neoenergia Elektro reconhecer "ELEKTRO" na API
-- (garante que futuras syncs não recriem o duplicado)
INSERT INTO public.concessionaria_aneel_aliases (concessionaria_id, alias_aneel, tenant_id)
SELECT '84f3db4f-e333-447f-bb2b-d35f9286991c', 'ELEKTRO', tenant_id
FROM public.concessionarias WHERE id = '84f3db4f-e333-447f-bb2b-d35f9286991c'
ON CONFLICT DO NOTHING;
