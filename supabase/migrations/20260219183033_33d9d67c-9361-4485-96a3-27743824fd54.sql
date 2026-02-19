
-- Fix proposta with wrong format (PROP-CLI-xxxx → PROP-xxxx)
UPDATE propostas_nativas
SET codigo = 'PROP-' || LPAD(nextval('public.proposta_code_seq')::TEXT, 4, '0')
WHERE codigo NOT SIMILAR TO 'PROP-[0-9]{4}';
