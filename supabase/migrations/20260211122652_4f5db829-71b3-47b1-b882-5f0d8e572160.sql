
-- ANTI-REGRESSÃO P0: Impedir tenant_id NULL em tabelas críticas do WhatsApp
-- Pré-condição validada: 0 registros com tenant_id NULL nestas 3 tabelas

ALTER TABLE public.wa_messages
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.wa_outbox
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN tenant_id SET NOT NULL;
