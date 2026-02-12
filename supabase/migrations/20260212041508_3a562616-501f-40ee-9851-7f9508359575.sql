
-- Tabela para persistir health checks por instância WhatsApp
CREATE TABLE public.wa_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  ok BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  evolution_state TEXT,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas recentes por instância
CREATE INDEX idx_wa_health_checks_instance_recent 
  ON public.wa_health_checks (instance_id, checked_at DESC);

-- Índice para limpeza por data
CREATE INDEX idx_wa_health_checks_tenant_checked 
  ON public.wa_health_checks (tenant_id, checked_at);

-- Enable RLS
ALTER TABLE public.wa_health_checks ENABLE ROW LEVEL SECURITY;

-- Política: admins podem ver checks do seu tenant
CREATE POLICY "Admins can view health checks"
  ON public.wa_health_checks
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.is_admin(auth.uid())
  );

-- Política: service_role insere (via edge function)
CREATE POLICY "Service role can insert health checks"
  ON public.wa_health_checks
  FOR INSERT
  WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.wa_health_checks IS 'Histórico de health checks das instâncias WhatsApp. Registros criados pela edge function integration-health-check.';

-- Função de limpeza (manter apenas últimos 7 dias)
CREATE OR REPLACE FUNCTION public.cleanup_wa_health_checks()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM wa_health_checks
  WHERE checked_at < now() - interval '7 days';
END;
$$;
