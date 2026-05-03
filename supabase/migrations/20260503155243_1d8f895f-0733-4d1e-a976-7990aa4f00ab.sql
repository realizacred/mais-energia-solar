-- FASE A.1 — Limpeza de sm_custom_field_mapping
-- Backup completo antes de deletar
CREATE TABLE IF NOT EXISTS sm_custom_field_mapping_backup_20260503 AS
SELECT * FROM public.sm_custom_field_mapping;

-- Remover entradas corrompidas com colchetes literais [cap_*] / [capo_*] / [cape_*]
DELETE FROM public.sm_custom_field_mapping
WHERE sm_field_key LIKE '[%]';

-- Garantir unicidade por (tenant_id, sm_field_key) — defensivo
CREATE UNIQUE INDEX IF NOT EXISTS sm_custom_field_mapping_tenant_key_uq
  ON public.sm_custom_field_mapping(tenant_id, sm_field_key);