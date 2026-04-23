
-- 1) Cancelar jobs zumbis (promote-all sem finished_at)
UPDATE public.solarmarket_promotion_jobs
   SET status = 'cancelled',
       finished_at = now(),
       error_summary = 'Cancelado: jobs antigos sem finished_at antes do fix de funil/etapa/external_id.'
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND status IN ('running','pending');

-- 2) Criar funil "Comercial" em projeto_funis (espelhando pipeline ea4aacc0)
WITH ins_funil AS (
  INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
  VALUES ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Comercial', 1, true)
  RETURNING id
)
INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
SELECT '17de8315-2e2f-4a79-8751-e5d507d69a41', f.id, e.nome, e.ordem, '#3b82f6'::text, e.categoria::projeto_etapa_categoria
  FROM ins_funil f
  CROSS JOIN (VALUES
    ('Recebido', 0, 'aberto'),
    ('Enviar Proposta', 1, 'aberto'),
    ('Proposta enviada', 2, 'aberto'),
    ('Qualificado', 3, 'aberto'),
    ('Negociação', 4, 'aberto'),
    ('Proposta Aprovada', 5, 'aberto'),
    ('Fechado', 6, 'ganho'),
    ('Perdido', 7, 'perdido')
  ) AS e(nome, ordem, categoria);

-- 3) Limpeza dos 48 projetos quebrados + dependentes
-- 3a) Propostas vinculadas (incluindo as 5 SM)
DELETE FROM public.propostas_nativas
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND projeto_id IN (
     SELECT id FROM public.projetos
      WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   );

-- 3b) Deals vinculados
DELETE FROM public.deals
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND projeto_id IN (
     SELECT id FROM public.projetos
      WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   );

-- 3c) Projetos
DELETE FROM public.projetos
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- 3d) Clientes órfãos importados da SolarMarket
DELETE FROM public.clientes
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND external_source = 'solarmarket'
   AND id NOT IN (SELECT cliente_id FROM public.projetos WHERE cliente_id IS NOT NULL);

-- 3e) Links de external_entity_links (source='solarmarket')
DELETE FROM public.external_entity_links
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND source = 'solarmarket';
