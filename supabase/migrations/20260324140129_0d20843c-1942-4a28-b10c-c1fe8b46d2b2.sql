
-- 1. Create normalization function (strips non-digits)
CREATE OR REPLACE FUNCTION public.normalize_cpf_cnpj()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cpf_cnpj IS NOT NULL AND NEW.cpf_cnpj != '' THEN
    NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj, '\D', '', 'g');
    IF NEW.cpf_cnpj = '' THEN
      NEW.cpf_cnpj := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to clientes
CREATE TRIGGER trg_normalize_cpf_cnpj
  BEFORE INSERT OR UPDATE OF cpf_cnpj ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_cpf_cnpj();

-- 3. Backfill existing data to digits-only
UPDATE public.clientes
SET cpf_cnpj = regexp_replace(cpf_cnpj, '\D', '', 'g')
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '' AND cpf_cnpj ~ '\D';

-- 4. Drop old index and recreate (same logic, now on normalized data)
DROP INDEX IF EXISTS public.idx_clientes_tenant_cpf_cnpj_unique;
CREATE UNIQUE INDEX idx_clientes_tenant_cpf_cnpj_unique
  ON public.clientes (tenant_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- 5. Add comment for documentation
COMMENT ON TRIGGER trg_normalize_cpf_cnpj ON public.clientes IS
  'Normalizes cpf_cnpj to digits-only before insert/update. Ensures unique index works regardless of input formatting.';
