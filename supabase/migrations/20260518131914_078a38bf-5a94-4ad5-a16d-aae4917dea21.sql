BEGIN;

WITH c AS (
  INSERT INTO public.clientes (tenant_id, nome)
  VALUES ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'TESTE_DEBUG_RB76_CLIENTE')
  RETURNING id
)
INSERT INTO public.projetos (tenant_id, nome, cliente_id)
SELECT '17de8315-2e2f-4a79-8751-e5d507d69a41', 'TESTE_DEBUG_RB76_PROJETO', c.id
FROM c
RETURNING id;

ROLLBACK;