UPDATE public.inversores_catalogo
SET status = 'publicado', updated_at = now()
WHERE id IN (
  'e5a3c9a6-9596-4c8c-8cc2-716219c5adc9', -- SOFAR 7.7KTLM-G3
  '63ee79f8-6014-4b21-8f08-070797e4683f'  -- SOFAR 7KTLM-G3
)
AND status = 'rascunho';