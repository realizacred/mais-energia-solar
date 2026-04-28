
INSERT INTO public.deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT 
  d.id,
  '01c0de2e-b523-4c8b-aa2f-8e505d36b74b'::uuid,
  CASE WHEN d.status = 'won' 
    THEN '6ae7184c-7343-4bed-874b-90d8878623f9'::uuid
    ELSE 'a65d8356-f386-46f4-a3bb-6f169fbfd4a0'::uuid
  END,
  d.tenant_id
FROM public.projetos p
JOIN public.deals d ON d.id = p.deal_id
WHERE p.external_source IN ('solar_market','solarmarket')
ON CONFLICT (deal_id, pipeline_id) DO NOTHING;
