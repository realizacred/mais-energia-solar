
-- CLEANUP: Remove 32 duplicate Samuel Cruz projects and phantom deals
-- Keep: PROJ-0020 (id: 4fa77575-e003-42ec-b060-b7598b989a29)

-- Step 1: Break FK on duplicates
UPDATE projetos SET deal_id = NULL
WHERE cliente_id = '73dc30f9-2961-41d7-89ba-91687ea3a635'
AND id != '4fa77575-e003-42ec-b060-b7598b989a29';

-- Step 2: Break FK on surviving project
UPDATE projetos SET deal_id = NULL
WHERE id = '4fa77575-e003-42ec-b060-b7598b989a29';

-- Step 3: Delete phantom deals
DELETE FROM deals 
WHERE projeto_id IN (
  SELECT id FROM projetos
  WHERE cliente_id = '73dc30f9-2961-41d7-89ba-91687ea3a635'
  AND id != '4fa77575-e003-42ec-b060-b7598b989a29'
);
DELETE FROM deals WHERE id = 'fcc3b831-2fa1-4603-9b40-4dbefd4d6671';

-- Step 4: Delete duplicate projects
DELETE FROM projetos
WHERE cliente_id = '73dc30f9-2961-41d7-89ba-91687ea3a635'
AND id != '4fa77575-e003-42ec-b060-b7598b989a29';

-- Step 5: Link surviving project to original deal
UPDATE projetos 
SET deal_id = 'a60dc6ac-7c0b-458c-b662-9dd2aa5771a2', updated_at = NOW()
WHERE id = '4fa77575-e003-42ec-b060-b7598b989a29';

UPDATE deals 
SET projeto_id = '4fa77575-e003-42ec-b060-b7598b989a29'
WHERE id = 'a60dc6ac-7c0b-458c-b662-9dd2aa5771a2';

-- Step 6: Preventive constraint (correct enum values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_unique_cliente_ativo
ON projetos(cliente_id)
WHERE status IN ('criado', 'aguardando_documentacao', 'em_analise', 'aprovado', 'em_instalacao');
