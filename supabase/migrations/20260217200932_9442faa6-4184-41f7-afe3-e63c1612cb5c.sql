
-- Migração dos deals do Vendedor para Comercial
-- Abordagem segura: mover deals, desativar pipeline (sem deletar stages que têm referências históricas)

-- 1. Mover deals 'open' para Prospecção do Comercial
UPDATE public.deals
SET pipeline_id = '9b5cbcf3-a101-4950-b699-778e2e1219e6',
    stage_id = '686ea5dd-d0bb-4038-826b-7c7ac74455fb',
    updated_at = now()
WHERE pipeline_id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0'
  AND status = 'open';

-- 2. Mover deal 'lost' para etapa Perdido do Comercial
UPDATE public.deals
SET pipeline_id = '9b5cbcf3-a101-4950-b699-778e2e1219e6',
    stage_id = (SELECT id FROM pipeline_stages WHERE pipeline_id = '9b5cbcf3-a101-4950-b699-778e2e1219e6' AND name = 'Perdido'),
    updated_at = now()
WHERE pipeline_id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0'
  AND status = 'lost';

-- 3. Limpar projeção antiga
DELETE FROM public.deal_kanban_projection
WHERE pipeline_id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0';

-- 4. Desativar pipeline Vendedor (preserva histórico)
UPDATE public.pipelines
SET is_active = false
WHERE id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0';
