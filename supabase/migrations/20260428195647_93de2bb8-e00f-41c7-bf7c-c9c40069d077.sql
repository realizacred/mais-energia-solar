-- Ensure every "Comercial" pipeline has a terminal "Perdido" stage
INSERT INTO public.pipeline_stages (pipeline_id, name, position, is_closed, is_won, probability, tenant_id)
SELECT
  p.id,
  'Perdido',
  COALESCE(MAX(ps.position), -1) + 1,
  true,
  false,
  0,
  p.tenant_id
FROM public.pipelines p
LEFT JOIN public.pipeline_stages ps ON ps.pipeline_id = p.id
WHERE lower(p.name) = 'comercial'
  AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages ps2
    WHERE ps2.pipeline_id = p.id
      AND ps2.is_closed = true
      AND ps2.is_won = false
  )
GROUP BY p.id, p.tenant_id;