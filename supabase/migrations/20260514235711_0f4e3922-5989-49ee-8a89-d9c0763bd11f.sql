-- Backfill de tokens de aceite para propostas migradas do SolarMarket
-- Usamos ON CONFLICT DO NOTHING sem alvo específico se não houver um índice único em proposta_id,
-- mas aqui o objetivo é inserir apenas se não existir.
INSERT INTO public.proposta_aceite_tokens (proposta_id, token, tenant_id)
SELECT id, gen_random_uuid(), tenant_id 
FROM public.propostas_nativas 
WHERE external_source = 'solarmarket'
AND id NOT IN (SELECT proposta_id FROM public.proposta_aceite_tokens WHERE proposta_id IS NOT NULL);

-- Atualiza public_token na tabela propostas_nativas para sincronizar
UPDATE public.propostas_nativas pn
SET public_token = pat.token
FROM public.proposta_aceite_tokens pat
WHERE pn.id = pat.proposta_id
AND pn.public_token IS NULL;