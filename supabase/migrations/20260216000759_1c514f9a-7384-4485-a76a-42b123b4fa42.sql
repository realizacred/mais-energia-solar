
-- ============================================================
-- AUDIT FIX: Atualizar template solar padrão para valores 2025/2026
-- ============================================================

-- 1. Corrigir Módulos Fotovoltaicos (preço caiu significativamente)
UPDATE pricing_cost_components
SET parameters = '{"unit_cost": 950}'::jsonb,
    description = 'Painéis solares mono PERC/TOPCon — custo médio por kWp (mercado BR 2025)',
    updated_at = now()
WHERE id = 'f04c2a79-4a94-4df1-9ae3-362eead4e92e';

-- 2. Corrigir Seguro — deve escalar com potência, não valor fixo
UPDATE pricing_cost_components
SET calculation_strategy = 'cost_per_kwp',
    parameters = '{"unit_cost": 120}'::jsonb,
    description = 'Seguro de obra + garantia estendida (proporcional à potência)',
    updated_at = now()
WHERE id = '5659d3ee-a36a-4e5a-8aab-d168ecf43c33';

-- 3. Adicionar componentes faltantes (version_id e tenant_id do existente)
INSERT INTO pricing_cost_components (version_id, tenant_id, category, name, description, calculation_strategy, parameters, display_order, is_active)
VALUES
  -- Simples Nacional (principal imposto de integradoras)
  ('bc30eb51-6d18-4ae2-b716-746e18df1e4d',
   (SELECT tenant_id FROM pricing_cost_components LIMIT 1),
   'Impostos', 'Simples Nacional / PIS+COFINS',
   'Tributação sobre faturamento (Simples Nacional anexo IV ou Lucro Presumido)',
   'percentage_of_cost', '{"percentage": 8}'::jsonb, 12, true),

  -- Margem de Lucro
  ('bc30eb51-6d18-4ae2-b716-746e18df1e4d',
   (SELECT tenant_id FROM pricing_cost_components LIMIT 1),
   'Margens', 'Margem de Lucro Bruta',
   'Margem sobre custo total antes de comissões',
   'percentage_of_cost', '{"percentage": 15}'::jsonb, 13, true),

  -- Comissão do Consultor
  ('bc30eb51-6d18-4ae2-b716-746e18df1e4d',
   (SELECT tenant_id FROM pricing_cost_components LIMIT 1),
   'Margens', 'Comissão do Consultor',
   'Comissão comercial sobre valor de venda',
   'percentage_of_cost', '{"percentage": 5}'::jsonb, 14, true),

  -- Reserva Técnica / Contingência
  ('bc30eb51-6d18-4ae2-b716-746e18df1e4d',
   (SELECT tenant_id FROM pricing_cost_components LIMIT 1),
   'Administrativo', 'Reserva Técnica (Contingência)',
   'Margem de segurança para imprevistos de obra (2-3%)',
   'percentage_of_cost', '{"percentage": 2.5}'::jsonb, 15, true);
