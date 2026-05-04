-- Tabela de configuração do resumo semanal WhatsApp (por tenant)
CREATE TABLE IF NOT EXISTS public.weekly_summary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  day_of_week smallint NOT NULL DEFAULT 1, -- 0=Dom, 1=Seg, ..., 6=Sab
  hour_local smallint NOT NULL DEFAULT 8,  -- 0-23, horário BRT
  template text NOT NULL DEFAULT 'Bom dia, {{primeiro_nome}}! 👋☀️

Aqui está seu resumo semanal:

📊 *Seus leads esta semana:*
• Total: {{total_leads}} leads
• 🔥 Hot (alta prioridade): {{hot_leads}}
• ⚠️ Sem classificação: {{sem_status}}
• ⏰ Follow-ups atrasados: {{followups_atrasados}}

{{cta_hot}}{{cta_sem_status}}
Bom trabalho! 💪
Mais Energia Solar 🌞',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_summary_dow_chk CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT weekly_summary_hour_chk CHECK (hour_local BETWEEN 0 AND 23)
);

ALTER TABLE public.weekly_summary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view weekly summary config"
  ON public.weekly_summary_config FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant admins can insert weekly summary config"
  ON public.weekly_summary_config FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant admins can update weekly summary config"
  ON public.weekly_summary_config FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_weekly_summary_config_updated_at
  BEFORE UPDATE ON public.weekly_summary_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar cron: rodar de hora em hora (a function decide quem enviar baseado no config do tenant)
SELECT cron.unschedule('notify-consultores-weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-consultores-weekly');

SELECT cron.schedule(
  'notify-consultores-weekly',
  '0 * * * *', -- toda hora cheia
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/notify-consultores-weekly',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{"cron": true}'::jsonb
  ) AS request_id;
  $$
);