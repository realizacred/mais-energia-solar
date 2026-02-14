
-- ═══════════════════════════════════════════════════════════
-- HORÁRIOS DE ATENDIMENTO + FERIADOS + AUTO-REPLY WA
-- ═══════════════════════════════════════════════════════════

-- 1) Horários de atendimento da empresa (por dia da semana)
CREATE TABLE public.tenant_horarios_atendimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=dom, 6=sab
  ativo BOOLEAN NOT NULL DEFAULT true,
  hora_inicio TIME NOT NULL DEFAULT '08:00',
  hora_fim TIME NOT NULL DEFAULT '18:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, dia_semana)
);

ALTER TABLE public.tenant_horarios_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_horarios_select" ON public.tenant_horarios_atendimento
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_horarios_insert" ON public.tenant_horarios_atendimento
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_horarios_update" ON public.tenant_horarios_atendimento
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_horarios_delete" ON public.tenant_horarios_atendimento
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_tenant_horarios_updated_at
  BEFORE UPDATE ON public.tenant_horarios_atendimento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default hours (Mon-Fri 08:00-18:00) via function for existing tenants
-- New tenants will need to be seeded on creation

-- 2) Feriados
CREATE TABLE public.tenant_feriados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'local' CHECK (tipo IN ('nacional', 'estadual', 'local')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, data)
);

ALTER TABLE public.tenant_feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_feriados_select" ON public.tenant_feriados
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_feriados_insert" ON public.tenant_feriados
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_feriados_update" ON public.tenant_feriados
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_feriados_delete" ON public.tenant_feriados
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_tenant_feriados_lookup ON public.tenant_feriados(tenant_id, data) WHERE ativo = true;

-- 3) Config de auto-reply fora do horário
CREATE TABLE public.wa_auto_reply_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  mensagem_fora_horario TEXT NOT NULL DEFAULT 'Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos assim que possível. 😊',
  mensagem_feriado TEXT NOT NULL DEFAULT 'Olá! Hoje estamos em recesso por feriado. Retornaremos no próximo dia útil. 😊',
  cooldown_minutos INTEGER NOT NULL DEFAULT 1440, -- 1x por dia por conversa (24h)
  silenciar_sla BOOLEAN NOT NULL DEFAULT true,
  silenciar_alertas BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_auto_reply_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_auto_reply_select" ON public.wa_auto_reply_config
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "wa_auto_reply_insert" ON public.wa_auto_reply_config
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "wa_auto_reply_update" ON public.wa_auto_reply_config
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_wa_auto_reply_updated_at
  BEFORE UPDATE ON public.wa_auto_reply_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) Tracking de auto-reply enviados (para cooldown)
CREATE TABLE public.wa_auto_reply_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'fora_horario' CHECK (tipo IN ('fora_horario', 'feriado')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_auto_reply_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_auto_reply_log_select" ON public.wa_auto_reply_log
  FOR SELECT USING (tenant_id = get_user_tenant_id());

-- Service role inserts (Edge Function), no user insert policy needed
CREATE INDEX idx_wa_auto_reply_log_cooldown ON public.wa_auto_reply_log(tenant_id, conversation_id, sent_at DESC);

-- 5) RPC para verificar se é horário comercial de um tenant
CREATE OR REPLACE FUNCTION public.is_within_business_hours(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _now TIMESTAMPTZ;
  _day SMALLINT;
  _time TIME;
  _is_holiday BOOLEAN;
  _is_open BOOLEAN;
BEGIN
  _now := now();
  _day := EXTRACT(DOW FROM _now)::SMALLINT; -- 0=Sunday
  _time := _now::TIME;

  -- Check holidays first
  SELECT EXISTS(
    SELECT 1 FROM tenant_feriados
    WHERE tenant_id = _tenant_id
      AND data = _now::DATE
      AND ativo = true
  ) INTO _is_holiday;

  IF _is_holiday THEN
    RETURN FALSE;
  END IF;

  -- Check business hours for today
  SELECT EXISTS(
    SELECT 1 FROM tenant_horarios_atendimento
    WHERE tenant_id = _tenant_id
      AND dia_semana = _day
      AND ativo = true
      AND _time BETWEEN hora_inicio AND hora_fim
  ) INTO _is_open;

  -- If no config exists, assume open (backwards compat)
  IF NOT EXISTS(SELECT 1 FROM tenant_horarios_atendimento WHERE tenant_id = _tenant_id) THEN
    RETURN TRUE;
  END IF;

  RETURN _is_open;
END;
$$;
