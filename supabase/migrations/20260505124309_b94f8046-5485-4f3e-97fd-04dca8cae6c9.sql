-- recibo_logs: histórico simples de envios/eventos por recibo
CREATE TABLE IF NOT EXISTS public.recibo_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT public.get_user_tenant_id(),
  recibo_id UUID NOT NULL REFERENCES public.recibos_emitidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                -- 'envio' | 'pdf_gerado' | 'status_alterado' | 'visualizado'
  canal TEXT,                        -- 'whatsapp' | 'email' | 'manual'
  destino TEXT,                      -- telefone / email destino
  mensagem TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_recibo_logs_recibo ON public.recibo_logs(recibo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recibo_logs_tenant ON public.recibo_logs(tenant_id);

ALTER TABLE public.recibo_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant select recibo_logs"
  ON public.recibo_logs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant insert recibo_logs"
  ON public.recibo_logs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant delete recibo_logs"
  ON public.recibo_logs FOR DELETE
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
