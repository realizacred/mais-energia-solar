
ALTER TABLE public.projeto_funis ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.projeto_etapas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE public.projeto_etiquetas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
