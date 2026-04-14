
-- =============================================
-- LIMPEZA DO CATÁLOGO WEB — 0 USAGE EM TODOS
-- =============================================

-- 1. Desativar duplicados (manter 1 canônico por nome)

-- Corporativo B2B: manter c8f97b88, desativar 2
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('7ad5d633-538b-47b4-bf10-d3c9ac009bb1', 'e287efbc-57ed-43f8-842d-cc9ce5c6599e');

-- Dashboard — Alta Conversão: manter e2cd8b9e, desativar 1
UPDATE public.proposta_templates SET ativo = false WHERE id = 'c4aee1f8-14a3-4fa8-a815-fc5ebacf0347';

-- Educacional — Leads: manter 04e8c7aa, desativar 2
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('8a220cd1-46ff-4801-81ee-0f458db23cc9', 'f32a8bd4-65b3-47be-b7c8-a131ea1d976d');

-- Fechamento Rápido — WhatsApp: manter 650fe902, desativar 3
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('b6cf9bef-d5bd-4f78-9a2f-f7118e89d5d4', '5d72441c-dbee-42aa-9b6d-3dcf2f331c52', '5dafbd25-f031-4475-bad3-4a06b34c974c');

-- Híbrido / Off-Grid: manter 2076a609, desativar 2
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('9dda3b81-b3a0-4670-bfea-89b1ec14a806', 'd6ffbbf1-b56e-4d04-9fca-c38d50c2f6e0');

-- Premium Consultivo: manter e4434ef7, desativar 2
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('75dcc901-9464-4301-a644-f034600c500e', 'fd52bbe8-48d3-44f9-a009-30631f4e8a2e');

-- 2. Desativar templates legado genéricos
UPDATE public.proposta_templates SET ativo = false WHERE id IN ('0bb148f6-f68f-4a68-9eee-a82a1c847e34', '1307b641-18ac-42a3-b13a-f921f30288b9');

-- 3. Corrigir categorias padrao → categorias reais nos canônicos
UPDATE public.proposta_templates SET categoria = 'alta_conversao' WHERE id = 'e2cd8b9e-f5e5-4786-8413-4389cc93f3aa';
UPDATE public.proposta_templates SET categoria = 'consultivo' WHERE id = 'e4434ef7-7943-4be6-82e6-85ddbc484563';
UPDATE public.proposta_templates SET categoria = 'whatsapp' WHERE id = '650fe902-86c1-4d43-9163-2a33d10cfb7f';
UPDATE public.proposta_templates SET categoria = 'educacional' WHERE id = '04e8c7aa-057f-4f03-b4b3-ec3c4fdccc88';
UPDATE public.proposta_templates SET categoria = 'corporativo' WHERE id = 'c8f97b88-c958-4bca-8db2-19fbb0dc472b';
UPDATE public.proposta_templates SET categoria = 'offgrid' WHERE id = '2076a609-ec52-423e-918a-20f927e92242';
UPDATE public.proposta_templates SET categoria = 'consultivo' WHERE id = '061735eb-dd30-4319-9cc0-dd6f2b593009';
UPDATE public.proposta_templates SET categoria = 'educacional' WHERE id = '4150e1d9-8024-4c7c-b406-dc54eada5cee';
