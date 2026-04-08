
-- Tabela de histórico de reagendamentos
CREATE TABLE public.appointment_reagendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  data_anterior timestamptz NOT NULL,
  nova_data timestamptz NOT NULL,
  motivo text NOT NULL,
  alterado_por uuid REFERENCES auth.users(id),
  notificou_wa boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.appointment_reagendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_appointment_reagendamentos"
  ON public.appointment_reagendamentos FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_insert_appointment_reagendamentos"
  ON public.appointment_reagendamentos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Índice para busca por appointment
CREATE INDEX idx_appointment_reagendamentos_appointment_id
  ON public.appointment_reagendamentos(appointment_id);

-- Template WA de reagendamento em tenant_premises
ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS wa_template_reagendamento_instalacao text;
