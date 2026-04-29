-- Fix trg_normalize_cliente_telefone: respeitar placeholders (RB-DEDUP-V4)
-- 1) Trigger deixa telefone_normalized NULL quando os dígitos são placeholder
--    (todos repetidos, terminam em 6+ noves/zeros, ou tamanho inválido).
-- 2) Backfill: zera telefone_normalized de clientes legados que já têm placeholder
--    gravado, liberando a constraint uq_clientes_tenant_telefone para novos inserts.
CREATE OR REPLACE FUNCTION public.normalize_cliente_telefone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  IF NEW.telefone IS NULL OR NEW.telefone = '' THEN
    NEW.telefone_normalized := NULL;
    RETURN NEW;
  END IF;

  digits := regexp_replace(NEW.telefone, '[^0-9]', '', 'g');

  -- RB-DEDUP-V4: placeholder NÃO entra no índice de unicidade.
  IF digits = '' 
     OR length(digits) NOT IN (10, 11)
     OR digits ~ '^(\d)\1+$'                 -- todos os dígitos iguais
     OR digits ~ '(9{6,}|0{6,})$'            -- termina em 6+ noves ou 6+ zeros
  THEN
    NEW.telefone_normalized := NULL;
  ELSE
    NEW.telefone_normalized := digits;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: limpa placeholders já gravados em clientes existentes.
UPDATE public.clientes
SET telefone_normalized = NULL
WHERE telefone_normalized IS NOT NULL
  AND (
    length(telefone_normalized) NOT IN (10, 11)
    OR telefone_normalized ~ '^(\d)\1+$'
    OR telefone_normalized ~ '(9{6,}|0{6,})$'
  );