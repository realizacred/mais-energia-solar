-- Backfill cirúrgico: clientes SM com telefone vazio mas com primaryPhone no payload
WITH alvos AS (
  SELECT
    c.id,
    regexp_replace(COALESCE(cr.payload->>'primaryPhone',''), '\D', '', 'g') AS digitos
  FROM public.clientes c
  JOIN public.sm_clientes_raw cr ON cr.payload->>'id' = c.external_id
  WHERE c.external_source = 'solarmarket'
    AND (c.telefone IS NULL OR c.telefone = '')
    AND COALESCE(cr.payload->>'primaryPhone','') <> ''
),
formatado AS (
  SELECT
    id,
    digitos,
    CASE
      -- 11 dígitos: (XX) XXXXX-XXXX
      WHEN length(digitos) = 11 THEN
        '(' || substring(digitos,1,2) || ') ' ||
        substring(digitos,3,5) || '-' || substring(digitos,8,4)
      -- 10 dígitos: (XX) XXXX-XXXX
      WHEN length(digitos) = 10 THEN
        '(' || substring(digitos,1,2) || ') ' ||
        substring(digitos,3,4) || '-' || substring(digitos,7,4)
      -- 12/13 dígitos com DDI 55: tira DDI e formata
      WHEN length(digitos) IN (12,13) AND substring(digitos,1,2) = '55' THEN
        CASE WHEN length(substring(digitos,3)) = 11 THEN
          '(' || substring(digitos,3,2) || ') ' ||
          substring(digitos,5,5) || '-' || substring(digitos,10,4)
        ELSE
          '(' || substring(digitos,3,2) || ') ' ||
          substring(digitos,5,4) || '-' || substring(digitos,9,4)
        END
      -- Fora do padrão: grava dígitos brutos para o usuário ver e corrigir
      ELSE digitos
    END AS telefone_fmt
  FROM alvos
)
UPDATE public.clientes c
SET
  telefone = f.telefone_fmt,
  telefone_normalized = COALESCE(NULLIF(c.telefone_normalized,''), f.digitos)
FROM formatado f
WHERE c.id = f.id;