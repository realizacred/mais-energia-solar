
-- Desabilitar trigger temporariamente
ALTER TABLE lead_status DISABLE TRIGGER trg_guard_system_lead_status;

-- Deletar duplicados (todos com 0 leads vinculados)
DELETE FROM lead_status WHERE id IN (
  '78a87ce8-b869-410e-b6e8-dcf36a2424ec',
  '95ab5b1d-e35f-42b7-bf10-ba10f395555a',
  '5f32c787-363c-433a-a3be-93cc5b6a2b96',
  '2c918392-9129-4c39-9a10-8ddbaed36d6e',
  '3828fe85-bbec-4cf7-872e-3f22623b40db',
  'b55bc691-f875-4c28-b167-0e5349156346',
  'a07b8727-0331-4431-a7c1-30a8d2b2326b',
  'c2d67200-d88e-4bc5-9967-7f7f5288734f'
);

-- Reabilitar trigger
ALTER TABLE lead_status ENABLE TRIGGER trg_guard_system_lead_status;

-- Constraint para prevenir duplicações futuras
ALTER TABLE lead_status ADD CONSTRAINT uq_lead_status_nome_tenant
  UNIQUE (tenant_id, nome);

-- Pipeline stages duplicados do tenant Teste
DELETE FROM pipeline_stages WHERE id IN (
  '97638c6e-5073-481b-b23f-5d3ae8a9d937',
  'ad70ded0-0868-4a9f-8b79-874be8e8cf9d',
  'b416e18b-b728-4fbd-812d-fe5ac9a9303a',
  '31cb33bd-89c3-4370-b674-61aa781d7db3',
  '16e43071-50f5-4d79-a430-fad6e4b5af3b',
  'c1545ab0-753b-4fcb-8b04-75b8aa3dfd54',
  '8a0e4f92-367e-4628-a378-f9839c521ebe',
  'fce295c1-73dc-4605-8414-ea7ba54b2b8d',
  '18aaeec5-3be8-42c7-b9b6-bb6c70b5b853',
  'cf68e36b-3d4c-43aa-834e-aa9a76bbea3e',
  '1f72878a-662e-4b44-a52e-2964ae1b2342',
  'ee497d09-3845-4269-b943-05813616951f',
  'bcc40ed3-3545-496e-9379-fcb8e4e65319',
  '650ae48d-842c-440b-9e0f-742b3dcba4fa',
  '848f454f-80f3-49a3-9ab7-708b1b0e74a2',
  'e04f976c-8203-4dc2-b478-fa519b3863a9',
  '5b9f6a51-de29-4c37-88fe-2d9bd39c8f78'
);

ALTER TABLE pipeline_stages ADD CONSTRAINT uq_pipeline_stages_name_pipeline
  UNIQUE (pipeline_id, name);
