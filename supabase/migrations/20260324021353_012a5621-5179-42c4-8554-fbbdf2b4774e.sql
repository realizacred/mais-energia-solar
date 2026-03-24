-- Add categoria_gd to gd_groups (the group defines the GD type)
ALTER TABLE public.gd_groups
  ADD COLUMN IF NOT EXISTS categoria_gd text DEFAULT NULL;

COMMENT ON COLUMN public.gd_groups.categoria_gd IS 'GD type: gd1 (autoconsumo local), gd2 (autoconsumo remoto), gd3 (compartilhado/cooperativa)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gd_groups_categoria_gd_check'
  ) THEN
    ALTER TABLE public.gd_groups
      ADD CONSTRAINT gd_groups_categoria_gd_check
      CHECK (categoria_gd IS NULL OR categoria_gd IN ('gd1', 'gd2', 'gd3'));
  END IF;
END $$;

-- UC name validation trigger
CREATE OR REPLACE FUNCTION public.validate_uc_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF length(trim(NEW.nome)) < 3 THEN
    RAISE EXCEPTION 'Nome da UC deve ter pelo menos 3 caracteres';
  END IF;
  
  IF trim(NEW.nome) !~ '[a-zA-ZÀ-ÿ]' THEN
    RAISE EXCEPTION 'Nome da UC deve conter pelo menos uma letra';
  END IF;
  
  IF trim(lower(NEW.nome)) IN ('teste', 'test', 'uc', 'unidade', '000', '0000', '00000', 'null', 'undefined', 'none', 'n/a') THEN
    RAISE EXCEPTION 'Nome da UC não pode ser um valor genérico';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_uc_name ON public.units_consumidoras;

CREATE TRIGGER trg_validate_uc_name
  BEFORE INSERT OR UPDATE OF nome ON public.units_consumidoras
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_uc_name();