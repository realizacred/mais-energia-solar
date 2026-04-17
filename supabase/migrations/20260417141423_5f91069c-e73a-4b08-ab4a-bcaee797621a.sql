UPDATE public.sm_project_classification
SET etapa_destino_id = 'aa37d670-8a01-4151-9d18-c4e604d71e95',
    motivo = 'Auto: funil="Compensação" etapa="Compensação aceita" (normalizado de typo "Compesação aceita")',
    updated_at = now()
WHERE pipeline_kind = 'compensacao'
  AND etapa_destino_id IS NULL
  AND funil_destino_id = 'a68af05e-34a6-46ce-a4d1-19842086438d';