CREATE OR REPLACE FUNCTION public.format_phone_br(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text; ddd text; rest text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  IF length(d) = 13 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) = 12 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) NOT IN (10, 11) THEN RETURN NULL; END IF;
  IF substr(d,1,2)::int < 11 OR substr(d,1,2)::int > 99 THEN RETURN NULL; END IF;
  ddd := substr(d, 1, 2); rest := substr(d, 3);
  IF length(rest) = 9 THEN
    RETURN '(' || ddd || ') ' || substr(rest,1,5) || '-' || substr(rest,6);
  ELSE
    RETURN '(' || ddd || ') ' || substr(rest,1,4) || '-' || substr(rest,5);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.canonical_phone_digits(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text; ddd text; rest text; canonical text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  d := split_part(raw, '@', 1);
  d := regexp_replace(d, '\D', '', 'g');
  IF length(d) = 13 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) = 12 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) NOT IN (10, 11) THEN RETURN NULL; END IF;
  ddd := substr(d, 1, 2); rest := substr(d, 3);
  IF substr(d,1,2)::int < 11 OR substr(d,1,2)::int > 99 THEN RETURN NULL; END IF;
  IF length(rest) = 8 AND substr(rest,1,1) IN ('8','9') THEN
    canonical := ddd || '9' || rest;
  ELSE
    canonical := d;
  END IF;
  IF canonical IN ('99999999999','00000000000','11111111111','12345678901') THEN RETURN NULL; END IF;
  IF canonical ~ '^(.)\1+$' THEN RETURN NULL; END IF;
  IF canonical ~ '(9{6,}|0{6,})$' THEN RETURN NULL; END IF;
  RETURN canonical;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_normalize_phone_with_norm()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE formatted text;
BEGIN
  IF NEW.telefone IS NOT NULL AND btrim(NEW.telefone) <> '' THEN
    formatted := public.format_phone_br(NEW.telefone);
    IF formatted IS NOT NULL THEN NEW.telefone := formatted; END IF;
    NEW.telefone_normalized := public.canonical_phone_digits(NEW.telefone);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_normalize_phone_simple()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE formatted text;
BEGIN
  IF NEW.telefone IS NOT NULL AND btrim(NEW.telefone) <> '' THEN
    formatted := public.format_phone_br(NEW.telefone);
    IF formatted IS NOT NULL THEN NEW.telefone := formatted; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_normalize_phone_clientes ON public.clientes;
CREATE TRIGGER trg_normalize_phone_clientes BEFORE INSERT OR UPDATE OF telefone ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_phone_with_norm();

DROP TRIGGER IF EXISTS trg_normalize_phone_leads ON public.leads;
CREATE TRIGGER trg_normalize_phone_leads BEFORE INSERT OR UPDATE OF telefone ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_phone_with_norm();

DROP TRIGGER IF EXISTS trg_normalize_phone_consultores ON public.consultores;
CREATE TRIGGER trg_normalize_phone_consultores BEFORE INSERT OR UPDATE OF telefone ON public.consultores
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_phone_simple();

DROP TRIGGER IF EXISTS trg_normalize_phone_profiles ON public.profiles;
CREATE TRIGGER trg_normalize_phone_profiles BEFORE INSERT OR UPDATE OF telefone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_phone_simple();

DROP TRIGGER IF EXISTS trg_normalize_phone_fornecedores ON public.fornecedores;
CREATE TRIGGER trg_normalize_phone_fornecedores BEFORE INSERT OR UPDATE OF telefone ON public.fornecedores
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_phone_simple();

UPDATE public.clientes SET telefone = public.format_phone_br(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NOT NULL;

UPDATE public.leads SET telefone = public.format_phone_br(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NOT NULL;

UPDATE public.consultores SET telefone = public.format_phone_br(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NOT NULL;

UPDATE public.consultores SET telefone = ''
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NULL;

UPDATE public.profiles SET telefone = public.format_phone_br(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NOT NULL;

UPDATE public.fornecedores SET telefone = public.format_phone_br(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> ''
  AND telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(telefone) IS NOT NULL;

UPDATE public.fornecedores SET contato_telefone = public.format_phone_br(contato_telefone)
WHERE contato_telefone IS NOT NULL AND btrim(contato_telefone) <> ''
  AND contato_telefone !~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$'
  AND public.format_phone_br(contato_telefone) IS NOT NULL;

UPDATE public.clientes SET telefone_normalized = public.canonical_phone_digits(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> '' AND telefone_normalized IS NULL
  AND public.canonical_phone_digits(telefone) IS NOT NULL;

UPDATE public.leads SET telefone_normalized = public.canonical_phone_digits(telefone)
WHERE telefone IS NOT NULL AND btrim(telefone) <> '' AND telefone_normalized IS NULL
  AND public.canonical_phone_digits(telefone) IS NOT NULL;

CREATE OR REPLACE VIEW public.v_auditoria_telefones AS
SELECT 'clientes'::text AS tabela, c.id::text AS registro_id, c.tenant_id, c.nome AS rotulo,
  c.telefone AS telefone_atual, c.telefone_normalized,
  public.format_phone_br(c.telefone) AS telefone_sugerido,
  CASE WHEN c.telefone IS NULL OR btrim(c.telefone)='' THEN 'vazio'
       WHEN c.telefone ~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$' THEN 'ok'
       WHEN public.format_phone_br(c.telefone) IS NOT NULL THEN 'corrigivel'
       ELSE 'invalido' END AS status_phone
FROM public.clientes c
UNION ALL
SELECT 'leads', l.id::text, l.tenant_id, l.nome, l.telefone, l.telefone_normalized,
  public.format_phone_br(l.telefone),
  CASE WHEN l.telefone IS NULL OR btrim(l.telefone)='' THEN 'vazio'
       WHEN l.telefone ~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$' THEN 'ok'
       WHEN public.format_phone_br(l.telefone) IS NOT NULL THEN 'corrigivel'
       ELSE 'invalido' END
FROM public.leads l
UNION ALL
SELECT 'consultores', co.id::text, co.tenant_id, co.nome, co.telefone, NULL,
  public.format_phone_br(co.telefone),
  CASE WHEN co.telefone IS NULL OR btrim(co.telefone)='' THEN 'vazio'
       WHEN co.telefone ~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$' THEN 'ok'
       WHEN public.format_phone_br(co.telefone) IS NOT NULL THEN 'corrigivel'
       ELSE 'invalido' END
FROM public.consultores co
UNION ALL
SELECT 'fornecedores', f.id::text, f.tenant_id, f.nome, f.telefone, NULL,
  public.format_phone_br(f.telefone),
  CASE WHEN f.telefone IS NULL OR btrim(f.telefone)='' THEN 'vazio'
       WHEN f.telefone ~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$' THEN 'ok'
       WHEN public.format_phone_br(f.telefone) IS NOT NULL THEN 'corrigivel'
       ELSE 'invalido' END
FROM public.fornecedores f;