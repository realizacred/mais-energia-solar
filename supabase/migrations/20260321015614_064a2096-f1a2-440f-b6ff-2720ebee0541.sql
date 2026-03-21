
-- TAREFA 1: Criar índices em tabelas de alto volume sem índice tenant_id

-- wa_webhook_events (15k rows)
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_tenant
ON wa_webhook_events(tenant_id, created_at DESC);

-- wa_messages (5k rows)
CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant_created
ON wa_messages(tenant_id, created_at DESC);

-- solar_market_sync_logs (2.8k rows)
CREATE INDEX IF NOT EXISTS idx_sm_sync_logs_tenant
ON solar_market_sync_logs(tenant_id, created_at DESC);

-- wa_reads (295 rows)
CREATE INDEX IF NOT EXISTS idx_wa_reads_tenant
ON wa_reads(tenant_id);

-- TAREFA 2: RLS em integration_provider_aliases
ALTER TABLE integration_provider_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read integration_provider_aliases"
ON integration_provider_aliases
FOR SELECT USING (true);

-- TAREFA 3: Remover índices customizados com 0 scans (libera ~55 MB)
DROP INDEX IF EXISTS idx_msm_tenant_plant_ts;
DROP INDEX IF EXISTS idx_monitor_readings_rt_plant_ts;
DROP INDEX IF EXISTS idx_monitor_payloads_tenant;
