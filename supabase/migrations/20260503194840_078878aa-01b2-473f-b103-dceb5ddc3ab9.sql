WITH pdfs AS (
  SELECT
    i.storage_path,
    split_part(i.source_record_id, ':', 1) AS sm_proposta_id
  FROM public.imported_files i
  WHERE i.source_system = 'solarmarket'
    AND i.status = 'success'
    AND i.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
)
UPDATE public.proposta_versoes pv
SET output_pdf_path = p.storage_path,
    updated_at = now()
FROM public.propostas_nativas pn,
     pdfs p
WHERE pv.proposta_id = pn.id
  AND pn.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND pn.external_source IN ('solar_market','solarmarket')
  AND pn.external_id = p.sm_proposta_id
  AND pv.output_pdf_path IS DISTINCT FROM p.storage_path;