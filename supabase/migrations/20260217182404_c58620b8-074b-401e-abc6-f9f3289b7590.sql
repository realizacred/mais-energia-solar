
-- ═══════════════════════════════════════════════════════════════
-- 1) Enrich projeto_etiquetas (columns already added by partial migration)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.projeto_etiquetas
  ADD COLUMN IF NOT EXISTS grupo text NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS short text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_projeto_etiquetas_grupo ON public.projeto_etiquetas(grupo);
CREATE INDEX IF NOT EXISTS idx_projeto_etiquetas_tenant_id ON public.projeto_etiquetas(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- 2) Update Engenharia pipeline stages
--    Keep existing stages that have deals, rename, add new ones
-- ═══════════════════════════════════════════════════════════════

-- Rename existing stages to match the new flow
UPDATE pipeline_stages SET name = 'Falta Documentos',     position = 0, probability = 10, is_closed = false, is_won = false
  WHERE id = '75b19254-084c-4506-9f07-1b0a8e86f041'; -- was "Novo"

UPDATE pipeline_stages SET name = 'Falta Dados Técnicos', position = 1, probability = 15, is_closed = false, is_won = false
  WHERE id = 'b3c41fac-9be6-476c-b988-766c41e47cb6'; -- was "Em Andamento"

-- "Ganho" stage has 1 deal - rename to Finalizado (position 9)
UPDATE pipeline_stages SET name = 'Finalizado', position = 9, probability = 100, is_closed = true, is_won = true
  WHERE id = 'ec49674e-69ae-4caa-9daa-8e8798116d19'; -- was "Ganho"

-- "Perdido" - keep as archive, move to end
UPDATE pipeline_stages SET position = 10, probability = 0
  WHERE id = 'f9e91cd9-2add-4b76-b611-55de9ee16405'; -- "Perdido"

-- Insert the 7 missing stages
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position, probability, is_closed, is_won) VALUES
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Elaboração do Projeto',  2, 25, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Pagamento TRT',          3, 35, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Projeto em Andamento',   4, 50, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Projeto Enviado',        5, 65, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Etapa de Obra',          6, 75, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Projetos Aprovados',     7, 85, false, false),
  ('9426cec6-e77d-4d11-8629-ec7f384d344c', '00000000-0000-0000-0000-000000000001', 'Vistoria',               8, 95, false, false);

-- ═══════════════════════════════════════════════════════════════
-- 3) Seed default etiquetas
-- ═══════════════════════════════════════════════════════════════

INSERT INTO projeto_etiquetas (tenant_id, nome, cor, grupo, short, icon, ordem) VALUES
  ('00000000-0000-0000-0000-000000000001', 'WEG',                'hsl(210,80%,50%)',   'fornecedor',  'WEG',  '🟦', 0),
  ('00000000-0000-0000-0000-000000000001', 'Growatt',            'hsl(0,60%,50%)',     'fornecedor',  'GRW',  '🟥', 1),
  ('00000000-0000-0000-0000-000000000001', 'Canadian',           'hsl(0,0%,50%)',      'fornecedor',  'CAN',  '⬜', 2),
  ('00000000-0000-0000-0000-000000000001', 'À Vista',            'hsl(142,70%,45%)',   'pagamento',   'AV',   '💵', 3),
  ('00000000-0000-0000-0000-000000000001', 'Financiado',         'hsl(45,90%,50%)',    'pagamento',   'FIN',  '🏦', 4),
  ('00000000-0000-0000-0000-000000000001', 'Boleto Parcelado',   'hsl(270,50%,50%)',   'pagamento',   'BOL',  '📄', 5),
  ('00000000-0000-0000-0000-000000000001', 'Urgente',            'hsl(0,80%,50%)',     'prioridade',  'URG',  '🔴', 6),
  ('00000000-0000-0000-0000-000000000001', 'Aguardando Cliente', 'hsl(28,95%,53%)',    'prioridade',  'AGC',  '🟠', 7),
  ('00000000-0000-0000-0000-000000000001', 'Documentação OK',    'hsl(142,70%,45%)',   'prioridade',  'DOC✓', '✅', 8);

-- ═══════════════════════════════════════════════════════════════
-- 4) RLS policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.projeto_etiquetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view etiquetas" ON public.projeto_etiquetas;
DROP POLICY IF EXISTS "Tenant users can insert etiquetas" ON public.projeto_etiquetas;
DROP POLICY IF EXISTS "Tenant users can update etiquetas" ON public.projeto_etiquetas;
DROP POLICY IF EXISTS "Tenant users can delete etiquetas" ON public.projeto_etiquetas;

CREATE POLICY "Tenant users can view etiquetas"
  ON public.projeto_etiquetas FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant users can insert etiquetas"
  ON public.projeto_etiquetas FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant users can update etiquetas"
  ON public.projeto_etiquetas FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant users can delete etiquetas"
  ON public.projeto_etiquetas FOR DELETE
  USING (tenant_id = get_user_tenant_id());
