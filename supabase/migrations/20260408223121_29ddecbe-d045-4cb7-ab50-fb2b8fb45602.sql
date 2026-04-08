
ALTER TABLE public.tenant_premises
ADD COLUMN IF NOT EXISTS concessionaria_motivos_reprovacao text[] DEFAULT ARRAY['Projeto em desacordo','Documentação incompleta','Equipamento incompatível','Problemas no aterramento','Inversor não homologado','Estrutura inadequada']::text[],
ADD COLUMN IF NOT EXISTS concessionaria_prazo_vistoria_dias integer DEFAULT 30;
