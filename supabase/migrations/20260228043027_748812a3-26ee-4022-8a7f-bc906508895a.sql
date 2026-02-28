-- Fix orphaned records from failed migration with deal_num/projeto_num/proposta_num = 0
-- These were created before the trigger fix, so they got 0 instead of auto-increment

-- Fix deal_num for Gabriel Martins deal
UPDATE deals 
SET deal_num = public.next_tenant_number(tenant_id, 'deal')
WHERE id = 'dd22f867-cbd2-4d5e-bc6b-8e28dae81696' AND deal_num = 0;

-- Fix projeto_num
UPDATE projetos
SET projeto_num = public.next_tenant_number(tenant_id, 'projeto')
WHERE id = 'f9a4e58a-8471-4695-8d20-abf740abd7b4' AND projeto_num = 0;

-- Fix proposta_num
UPDATE propostas_nativas
SET proposta_num = public.next_tenant_number(tenant_id, 'proposta')
WHERE id = '88223f54-69c7-4a25-95eb-884f27a65e7f' AND proposta_num = 0;