CREATE TABLE IF NOT EXISTS variable_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  templates_ativos integer,
  total_variaveis integer,
  quebradas integer,
  ok integer,
  analise_ia text,
  prompt_lovable text,
  resultado_json jsonb,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE variable_audit_reports ENABLE ROW LEVEL SECURITY;

-- Política básica para permitir acesso (será refinada conforme necessário)
CREATE POLICY "tenant_select_variables_audit" ON variable_audit_reports FOR SELECT USING (true);
CREATE POLICY "tenant_insert_variables_audit" ON variable_audit_reports FOR INSERT WITH CHECK (true);