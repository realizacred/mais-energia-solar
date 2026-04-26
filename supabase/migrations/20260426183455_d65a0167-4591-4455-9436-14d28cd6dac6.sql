
-- ============================================================
-- PARTE 1 — Cancelar jobs órfãos (RB-66)
-- Coluna correta: error_summary (não error_message)
-- ============================================================
UPDATE public.solarmarket_promotion_jobs
SET status = 'cancelled',
    finished_at = COALESCE(finished_at, now()),
    error_summary = COALESCE(error_summary, 'Cancelado automaticamente: job órfão sem progresso > 5min')
WHERE status IN ('running', 'pending')
  AND (last_step_at IS NULL OR last_step_at < now() - interval '5 minutes')
  AND created_at < now() - interval '5 minutes';

-- ============================================================
-- PARTE 2 — Helpers temporários de formatação (RB-62)
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.fmt_nome(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text; parts text[]; out_parts text[] := '{}'; word text; i int;
  lowers text[] := ARRAY['de','da','do','dos','das','e','di','du'];
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(regexp_replace(raw, '\s+', ' ', 'g'));
  IF s = '' THEN RETURN NULL; END IF;
  parts := string_to_array(lower(s), ' ');
  FOR i IN 1..array_length(parts,1) LOOP
    word := parts[i];
    IF i > 1 AND word = ANY(lowers) THEN
      out_parts := out_parts || word;
    ELSE
      out_parts := out_parts || (upper(substr(word,1,1)) || substr(word,2));
    END IF;
  END LOOP;
  RETURN array_to_string(out_parts, ' ');
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_phone(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text; ddd text; rest text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  IF length(d) IN (12,13) AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) NOT IN (10,11) THEN RETURN NULL; END IF;
  ddd := substr(d,1,2); rest := substr(d,3);
  IF length(rest) = 9 THEN
    RETURN '(' || ddd || ') ' || substr(rest,1,5) || '-' || substr(rest,6);
  ELSE
    RETURN '(' || ddd || ') ' || substr(rest,1,4) || '-' || substr(rest,5);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_phone_norm(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  IF length(d) IN (12,13) AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) NOT IN (10,11) THEN RETURN NULL; END IF;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_doc(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  IF length(d) = 11 THEN
    RETURN substr(d,1,3)||'.'||substr(d,4,3)||'.'||substr(d,7,3)||'-'||substr(d,10,2);
  ELSIF length(d) = 14 THEN
    RETURN substr(d,1,2)||'.'||substr(d,3,3)||'.'||substr(d,6,3)||'/'||substr(d,9,4)||'-'||substr(d,13,2);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_cep(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  IF length(d) <> 8 THEN RETURN NULL; END IF;
  RETURN substr(d,1,5)||'-'||substr(d,6,3);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_email(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := lower(btrim(raw));
  IF s = '' THEN RETURN NULL; END IF;
  IF s !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RETURN NULL; END IF;
  RETURN s;
END;
$$;

-- ============================================================
-- PARTE 3 — Re-formatação de clientes migrados do SolarMarket (RB-62)
-- ============================================================
UPDATE public.clientes c
SET
  nome              = COALESCE(pg_temp.fmt_nome(c.nome), c.nome),
  telefone          = COALESCE(pg_temp.fmt_phone(c.telefone), c.telefone),
  telefone_normalized = COALESCE(pg_temp.fmt_phone_norm(c.telefone), c.telefone_normalized),
  cpf_cnpj          = COALESCE(pg_temp.fmt_doc(c.cpf_cnpj), c.cpf_cnpj),
  cep               = COALESCE(pg_temp.fmt_cep(c.cep), c.cep),
  email             = pg_temp.fmt_email(c.email),
  updated_at        = now()
WHERE c.external_source IN ('solar_market', 'solarmarket')
  AND (
        pg_temp.fmt_nome(c.nome)           IS DISTINCT FROM c.nome
     OR pg_temp.fmt_phone(c.telefone)      IS DISTINCT FROM c.telefone
     OR pg_temp.fmt_phone_norm(c.telefone) IS DISTINCT FROM c.telefone_normalized
     OR pg_temp.fmt_doc(c.cpf_cnpj)        IS DISTINCT FROM c.cpf_cnpj
     OR pg_temp.fmt_cep(c.cep)             IS DISTINCT FROM c.cep
     OR pg_temp.fmt_email(c.email)         IS DISTINCT FROM c.email
  );
