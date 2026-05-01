UPDATE public.projeto_funis
SET papel = 'comercial'::papel_funil
WHERE ativo = true
  AND papel = 'outro'::papel_funil
  AND nome ILIKE '%comercial%';