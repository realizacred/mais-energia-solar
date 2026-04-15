
-- 1. Assign funil Comercial + etapa "Ganho" to projects whose deal stage is Ganho or Fechado
UPDATE projetos
SET funil_id = '42c215c2-7bee-47c9-a296-f4ab033a531a',
    etapa_id = '73063be8-a7ff-47d7-8f70-7c1a8ff6b397'
WHERE import_source = 'solar_market'
  AND funil_id IS NULL
  AND deal_id IN (
    SELECT d.id FROM deals d
    WHERE d.import_source = 'solar_market'
      AND d.stage_id IN (
        '77d54560-75a1-4be0-b603-deff82990d42', -- Ganho
        '6a08ea07-d643-4f95-af16-af523f763282'  -- Fechado
      )
  );

-- 2. Assign funil Comercial + etapa "Perdido" to projects whose deal stage is Perdido
UPDATE projetos
SET funil_id = '42c215c2-7bee-47c9-a296-f4ab033a531a',
    etapa_id = '76f65607-c8b7-4f19-accd-d4f795410479'
WHERE import_source = 'solar_market'
  AND funil_id IS NULL
  AND deal_id IN (
    SELECT d.id FROM deals d
    WHERE d.import_source = 'solar_market'
      AND d.stage_id = 'fe71c78d-6c11-4798-989d-24020c77a059' -- Perdido
  );

-- 3. Assign funil Comercial + etapa "Em Andamento" to all remaining projects without funil
UPDATE projetos
SET funil_id = '42c215c2-7bee-47c9-a296-f4ab033a531a',
    etapa_id = 'ca00cec1-46ff-4980-907b-1b4baf4b1821'
WHERE import_source = 'solar_market'
  AND funil_id IS NULL;

-- 4. Deactivate SDR / Prospecção funil (no projects, no etapas, not requested)
UPDATE projeto_funis
SET ativo = false
WHERE id = '6078ee9d-7059-4dbe-aeee-39c0e84f1e09';
