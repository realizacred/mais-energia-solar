
ALTER TABLE proposta_versoes DROP CONSTRAINT proposta_versoes_grupo_check;
ALTER TABLE proposta_versoes ADD CONSTRAINT proposta_versoes_grupo_check 
  CHECK (grupo IS NULL OR grupo = ANY (ARRAY['A'::text, 'B'::text]));
