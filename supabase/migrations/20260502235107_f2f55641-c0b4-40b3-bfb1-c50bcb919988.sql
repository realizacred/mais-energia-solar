-- Wave 3 — Performance: índices críticos por tenant_id e compostos seletivos.
-- Idempotente; sem CONCURRENTLY (migrações Supabase rodam em transação).

-- monitor_string_metrics (1.5M linhas) — já tem (device_id, ts) e (registry_id, ts).
CREATE INDEX IF NOT EXISTS idx_msm_tenant_ts
  ON public.monitor_string_metrics (tenant_id, ts DESC);

-- monitor_provider_payloads (177k linhas) — já tem (received_at).
CREATE INDEX IF NOT EXISTS idx_mpp_tenant_received_at
  ON public.monitor_provider_payloads (tenant_id, received_at DESC);

-- deal_custom_field_values — já tem unique (deal_id, field_id).
CREATE INDEX IF NOT EXISTS idx_dcfv_tenant
  ON public.deal_custom_field_values (tenant_id);

-- proposta_aceite_tokens — já tem (proposta_id) parciais.
CREATE INDEX IF NOT EXISTS idx_pat_tenant
  ON public.proposta_aceite_tokens (tenant_id);

-- proposta_versao_ucs — já tem (versao_id).
CREATE INDEX IF NOT EXISTS idx_pvu_tenant_versao
  ON public.proposta_versao_ucs (tenant_id, versao_id);
