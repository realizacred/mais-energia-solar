
-- Converter todos os módulos do tenant administrativo para catálogo global (tenant_id = NULL)
-- Isso garante visibilidade para todos os tenants conforme a RLS policy existente
UPDATE modulos_solares 
SET tenant_id = NULL 
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
