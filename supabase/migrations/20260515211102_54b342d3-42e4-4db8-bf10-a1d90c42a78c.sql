-- 1. Create a function to generate sequence-based codes CLI-YYYY-XXXX
CREATE OR REPLACE FUNCTION public.fn_generate_client_code(_tenant_id UUID, _prefix TEXT DEFAULT 'CLI')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _year TEXT;
    _new_val INTEGER;
    _final_code TEXT;
BEGIN
    _year := to_char(now(), 'YYYY');
    
    -- Ensure counter row exists for this tenant
    INSERT INTO tenant_counters (tenant_id, cliente_code)
    VALUES (_tenant_id, 0)
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Increment and get value
    UPDATE tenant_counters
    SET cliente_code = cliente_code + 1
    WHERE tenant_id = _tenant_id
    RETURNING cliente_code INTO _new_val;

    _final_code := _prefix || '-' || _year || '-' || LPAD(_new_val::TEXT, 4, '0');
    
    RETURN _final_code;
END;
$$;

-- 2. Trigger function to auto-assign code on insert if NULL
CREATE OR REPLACE FUNCTION public.trg_fn_assign_client_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cliente_code IS NULL OR NEW.cliente_code = '' OR NEW.cliente_code LIKE 'CLI-%' AND length(NEW.cliente_code) > 15 THEN
        NEW.cliente_code := public.fn_generate_client_code(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_assign_client_code ON public.clientes;
CREATE TRIGGER trg_assign_client_code
BEFORE INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_assign_client_code();

-- 4. Storage path normalization logic helper
CREATE OR REPLACE FUNCTION public.safe_storage_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Normalize to lowercase, remove accents, replace spaces/special with hyphen
    RETURN lower(
        regexp_replace(
            regexp_replace(
                unaccent(input_text),
                '[^a-zA-Z0-9\s/]', '', 'g'
            ),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;
