
-- Tabela de notificações de inteligência em tempo real
CREATE TABLE IF NOT EXISTS intelligence_realtime_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  lead_id uuid REFERENCES leads(id) NOT NULL,
  mensagem_id uuid,
  tipo_notificacao varchar(50) NOT NULL,
  temperamento_anterior varchar(20),
  temperamento_novo varchar(20),
  urgencia_score int,
  sugestao_resposta text,
  contexto_json jsonb DEFAULT '{}',
  lida boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_realtime_notif_tenant ON intelligence_realtime_notifications(tenant_id, created_at DESC);
CREATE INDEX idx_realtime_notif_lead ON intelligence_realtime_notifications(lead_id, created_at DESC);
CREATE INDEX idx_realtime_notif_nao_lidas ON intelligence_realtime_notifications(tenant_id, lida) WHERE lida = false;

ALTER TABLE intelligence_realtime_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation realtime notifications select"
ON intelligence_realtime_notifications FOR SELECT
TO authenticated
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation realtime notifications update"
ON intelligence_realtime_notifications FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Service role full access realtime notifications"
ON intelligence_realtime_notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE intelligence_realtime_notifications;
