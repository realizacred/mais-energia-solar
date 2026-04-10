-- Atualizar projetos de Engenharia
UPDATE projetos
SET 
  funil_id = '9426cec6-e77d-4d11-8629-ec7f384d344c',
  etapa_id = '75b19254-084c-4506-9f07-1b0a8e86f041'
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND origem = 'imported'
AND funil_id IS NULL
AND deal_id IN (
  SELECT d.id FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  JOIN pipelines p ON p.id = d.pipeline_id
  WHERE p.name ILIKE 'Engenharia'
  AND d.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
);

-- Atualizar projetos dos demais funis (Comercial, Equipamento, etc.) → funil Vendedor
UPDATE projetos
SET
  funil_id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0',
  etapa_id = '2484fdfa-dcda-4dcb-86ac-ce68ac26973e'
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND origem = 'imported'
AND funil_id IS NULL;