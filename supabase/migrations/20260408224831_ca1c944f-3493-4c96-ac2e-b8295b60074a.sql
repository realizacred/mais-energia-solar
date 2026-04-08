
-- 1. Add 'instalacao' to appointment_type enum
ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'instalacao';

-- 2. Add WA notification columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS wa_notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS notificar_wa boolean NOT NULL DEFAULT true;

-- 3. Add WA template for installation scheduling in tenant_premises
ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS wa_template_agendamento_instalacao text
    DEFAULT 'Olá {{nome_cliente}}! Sua instalação solar está agendada para {{data}} às {{hora}}. Qualquer dúvida, fale com {{consultor}}.';
