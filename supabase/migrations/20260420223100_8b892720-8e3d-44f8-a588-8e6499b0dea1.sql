-- P0-1: Adicionar UNIQUE composto em todas as tabelas staging SolarMarket
-- Garante idempotência real do upsert (onConflict tenant_id,external_id) e
-- previne contaminação cross-tenant ou duplicação por race condition.

ALTER TABLE public.sm_propostas_raw
  ADD CONSTRAINT sm_propostas_raw_tenant_external_unique
  UNIQUE (tenant_id, external_id);

ALTER TABLE public.sm_clientes_raw
  ADD CONSTRAINT sm_clientes_raw_tenant_external_unique
  UNIQUE (tenant_id, external_id);

ALTER TABLE public.sm_projetos_raw
  ADD CONSTRAINT sm_projetos_raw_tenant_external_unique
  UNIQUE (tenant_id, external_id);

ALTER TABLE public.sm_funis_raw
  ADD CONSTRAINT sm_funis_raw_tenant_external_unique
  UNIQUE (tenant_id, external_id);

ALTER TABLE public.sm_custom_fields_raw
  ADD CONSTRAINT sm_custom_fields_raw_tenant_external_unique
  UNIQUE (tenant_id, external_id);