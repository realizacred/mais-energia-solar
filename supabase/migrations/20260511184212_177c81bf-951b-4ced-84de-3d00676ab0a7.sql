ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS nome text;
COMMENT ON COLUMN public.projetos.nome IS 'Nome próprio do projeto/empreendimento. Não confundir com nome do cliente.';