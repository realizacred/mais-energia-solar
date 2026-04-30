
UPDATE public.leads
SET telefone_normalized =
  substr(telefone_normalized, 1, 2) || '9' || substr(telefone_normalized, 3)
WHERE deleted_at IS NULL
  AND telefone_normalized IS NOT NULL
  AND length(telefone_normalized) = 10
  AND substr(telefone_normalized, 3, 1) IN ('8', '9');
