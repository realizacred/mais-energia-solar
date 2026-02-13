
-- =============================================
-- FASE 1: Tabela de Agendamentos + Config
-- =============================================

-- Enum para tipos de compromisso
CREATE TYPE public.appointment_type AS ENUM ('call', 'meeting', 'followup', 'visit', 'other');

-- Enum para status do compromisso
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'missed');

-- Enum para modo de sync Google
CREATE TYPE public.gcal_sync_mode AS ENUM ('create_only', 'bidirectional');

-- =============================================
-- Tabela principal de compromissos (SOURCE OF TRUTH)
-- =============================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT get_user_tenant_id() REFERENCES tenants(id),
  
  -- Quem criou e quem é responsável
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Vínculo opcional com conversa WhatsApp e lead/cliente
  conversation_id UUID REFERENCES wa_conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  
  -- Dados do compromisso
  title TEXT NOT NULL,
  description TEXT,
  appointment_type appointment_type NOT NULL DEFAULT 'call',
  status appointment_status NOT NULL DEFAULT 'scheduled',
  
  -- Data/hora
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  
  -- Lembrete (minutos antes)
  reminder_minutes INT DEFAULT 15,
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Google Calendar sync
  google_event_id TEXT,
  google_sync_status TEXT DEFAULT 'none', -- none | synced | pending | failed
  google_sync_error TEXT,
  google_synced_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_assigned ON appointments(assigned_to, starts_at);
CREATE INDEX idx_appointments_conversation ON appointments(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_appointments_starts ON appointments(starts_at);
CREATE INDEX idx_appointments_status ON appointments(tenant_id, status, starts_at);
CREATE INDEX idx_appointments_reminder ON appointments(starts_at, reminder_sent, status) WHERE status = 'scheduled' AND reminder_sent = false;

-- Trigger updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select" ON appointments
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "appointments_update" ON appointments
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "appointments_delete" ON appointments
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Audit trigger
CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- =============================================
-- Config de agenda por tenant
-- =============================================
CREATE TABLE public.agenda_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE DEFAULT get_user_tenant_id() REFERENCES tenants(id),
  
  -- Toggles
  agenda_enabled BOOLEAN NOT NULL DEFAULT true,
  google_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Modo de sync
  google_sync_mode gcal_sync_mode NOT NULL DEFAULT 'create_only',
  
  -- Filtro de tipos para sync
  google_sync_types appointment_type[] DEFAULT '{call,meeting}',
  
  -- Calendário padrão
  google_default_calendar_id TEXT DEFAULT 'primary',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_agenda_config_updated_at
  BEFORE UPDATE ON agenda_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE agenda_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_config_select" ON agenda_config
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "agenda_config_insert" ON agenda_config
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "agenda_config_update" ON agenda_config
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- =============================================
-- Log de sync Google (para admin ver erros)
-- =============================================
CREATE TABLE public.agenda_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT get_user_tenant_id() REFERENCES tenants(id),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- create | update | delete | retry
  status TEXT NOT NULL, -- success | error
  error_message TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_sync_logs_tenant ON agenda_sync_logs(tenant_id, created_at DESC);
CREATE INDEX idx_agenda_sync_logs_appointment ON agenda_sync_logs(appointment_id);

ALTER TABLE agenda_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_sync_logs_select" ON agenda_sync_logs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "agenda_sync_logs_insert" ON agenda_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Cleanup de logs antigos (mantém 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_agenda_sync_logs()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM agenda_sync_logs WHERE created_at < now() - interval '30 days';
END;
$$;
