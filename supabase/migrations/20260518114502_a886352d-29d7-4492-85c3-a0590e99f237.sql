ALTER TABLE public.pipeline_automations 
  DROP CONSTRAINT IF EXISTS check_canal_notificacao;

ALTER TABLE public.pipeline_automations
  ADD CONSTRAINT check_canal_notificacao
  CHECK (
    canal_notificacao IS NULL 
    OR canal_notificacao IN (
      'whatsapp', 'email', 'inApp', 'webhook', 
      'mover_etapa', 'criar_atividade', 
      'projeto', 'cliente', 'atividade'
    )
  );