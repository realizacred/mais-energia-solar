-- Move as variáveis customizadas para o tenant correto (Mais Energia Solar)
UPDATE public.proposta_variaveis_custom
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';