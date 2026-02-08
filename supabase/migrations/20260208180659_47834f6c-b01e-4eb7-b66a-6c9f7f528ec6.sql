
-- ============================================================
-- MOTOR DE PAYBACK PROFISSIONAL - Lei 14.300, Fio B, ICMS
-- ============================================================

-- 1. Tabela Fio B Escalonamento (Lei 14.300 - GD II)
CREATE TABLE public.fio_b_escalonamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano integer NOT NULL,
  percentual_nao_compensado numeric NOT NULL DEFAULT 0,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ano, tenant_id)
);

COMMENT ON TABLE public.fio_b_escalonamento IS 'Escalonamento do Fio B conforme Lei 14.300 para GD II';
COMMENT ON COLUMN public.fio_b_escalonamento.percentual_nao_compensado IS 'Percentual da TUSD Fio B que NÃO é compensado (cobrado do prosumidor)';

ALTER TABLE public.fio_b_escalonamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fio_b_escalonamento"
  ON public.fio_b_escalonamento FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Public read fio_b_escalonamento"
  ON public.fio_b_escalonamento FOR SELECT TO anon, authenticated
  USING (true);

-- Seed Fio B padrão conforme Lei 14.300
INSERT INTO public.fio_b_escalonamento (ano, percentual_nao_compensado) VALUES
  (2023, 15),
  (2024, 30),
  (2025, 45),
  (2026, 60),
  (2027, 75),
  (2028, 90);

-- Trigger updated_at
CREATE TRIGGER update_fio_b_escalonamento_updated_at
  BEFORE UPDATE ON public.fio_b_escalonamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Configuração Tributária por Estado (ICMS + SCEE)
-- ============================================================
CREATE TABLE public.config_tributaria_estado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estado text NOT NULL,
  aliquota_icms numeric NOT NULL DEFAULT 18,
  possui_isencao_scee boolean NOT NULL DEFAULT false,
  percentual_isencao numeric NOT NULL DEFAULT 0,
  observacoes text,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estado, tenant_id)
);

COMMENT ON TABLE public.config_tributaria_estado IS 'Configuração tributária por estado (ICMS e isenção SCEE para GD)';
COMMENT ON COLUMN public.config_tributaria_estado.possui_isencao_scee IS 'Se o estado concede isenção de ICMS sobre energia compensada via SCEE';
COMMENT ON COLUMN public.config_tributaria_estado.percentual_isencao IS 'Percentual da isenção ICMS sobre energia compensada (0-100)';

ALTER TABLE public.config_tributaria_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage config_tributaria_estado"
  ON public.config_tributaria_estado FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Public read config_tributaria_estado"
  ON public.config_tributaria_estado FOR SELECT TO anon, authenticated
  USING (true);

-- Seed todos os estados brasileiros com valores aproximados 2025
INSERT INTO public.config_tributaria_estado (estado, aliquota_icms, possui_isencao_scee, percentual_isencao, observacoes) VALUES
  ('AC', 19, true,  100, 'Isenção ICMS SCEE - Convênio ICMS 16/2015'),
  ('AL', 19, true,  100, 'Isenção ICMS SCEE'),
  ('AP', 18, true,  100, 'Isenção ICMS SCEE'),
  ('AM', 20, true,  100, 'Isenção ICMS SCEE'),
  ('BA', 20.5, true, 100, 'Isenção ICMS SCEE'),
  ('CE', 20, true,  100, 'Isenção ICMS SCEE'),
  ('DF', 20, true,  100, 'Isenção ICMS SCEE'),
  ('ES', 17, true,  100, 'Isenção ICMS SCEE'),
  ('GO', 19, true,  100, 'Isenção ICMS SCEE'),
  ('MA', 22, true,  100, 'Isenção ICMS SCEE'),
  ('MT', 17, true,  100, 'Isenção ICMS SCEE'),
  ('MS', 17, true,  100, 'Isenção ICMS SCEE'),
  ('MG', 18, true,  100, 'Isenção ICMS SCEE - Resolução SEF'),
  ('PA', 19, true,  100, 'Isenção ICMS SCEE'),
  ('PB', 20, true,  100, 'Isenção ICMS SCEE'),
  ('PR', 19.5, true, 100, 'Isenção ICMS SCEE'),
  ('PE', 20.5, true, 100, 'Isenção ICMS SCEE'),
  ('PI', 21, true,  100, 'Isenção ICMS SCEE'),
  ('RJ', 20, false,  0, 'RJ NÃO aderiu ao Convênio ICMS 16/2015 - sem isenção'),
  ('RN', 18, true,  100, 'Isenção ICMS SCEE'),
  ('RS', 17, true,  100, 'Isenção ICMS SCEE'),
  ('RO', 17.5, true, 100, 'Isenção ICMS SCEE'),
  ('RR', 20, true,  100, 'Isenção ICMS SCEE'),
  ('SC', 17, true,  100, 'Isenção ICMS SCEE'),
  ('SP', 18, false,  0, 'SP possui regras próprias - verificar legislação vigente'),
  ('SE', 19, true,  100, 'Isenção ICMS SCEE'),
  ('TO', 20, true,  100, 'Isenção ICMS SCEE');

CREATE TRIGGER update_config_tributaria_estado_updated_at
  BEFORE UPDATE ON public.config_tributaria_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Configuração Geral de Payback
-- ============================================================
CREATE TABLE public.payback_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custo_disponibilidade_monofasico numeric NOT NULL DEFAULT 30,
  custo_disponibilidade_bifasico numeric NOT NULL DEFAULT 50,
  custo_disponibilidade_trifasico numeric NOT NULL DEFAULT 100,
  taxas_fixas_mensais numeric NOT NULL DEFAULT 0,
  degradacao_anual_painel numeric NOT NULL DEFAULT 0.8,
  reajuste_anual_tarifa numeric NOT NULL DEFAULT 5.0,
  tarifa_fio_b_padrao numeric NOT NULL DEFAULT 0.40,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payback_config IS 'Configurações gerais para cálculo de payback profissional';
COMMENT ON COLUMN public.payback_config.degradacao_anual_painel IS 'Percentual de degradação anual da geração dos painéis (ex: 0.8 = 0.8% ao ano)';
COMMENT ON COLUMN public.payback_config.reajuste_anual_tarifa IS 'Percentual estimado de reajuste anual da tarifa de energia (ex: 5 = 5% ao ano)';
COMMENT ON COLUMN public.payback_config.tarifa_fio_b_padrao IS 'Tarifa Fio B padrão (R$/kWh) quando não configurada na concessionária';

ALTER TABLE public.payback_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payback_config"
  ON public.payback_config FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated read payback_config"
  ON public.payback_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon read payback_config"
  ON public.payback_config FOR SELECT TO anon
  USING (true);

-- Seed config padrão
INSERT INTO public.payback_config (
  custo_disponibilidade_monofasico,
  custo_disponibilidade_bifasico,
  custo_disponibilidade_trifasico,
  taxas_fixas_mensais,
  degradacao_anual_painel,
  reajuste_anual_tarifa,
  tarifa_fio_b_padrao
) VALUES (30, 50, 100, 0, 0.8, 5.0, 0.40);

CREATE TRIGGER update_payback_config_updated_at
  BEFORE UPDATE ON public.payback_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Campos adicionais na tabela concessionarias
-- ============================================================
ALTER TABLE public.concessionarias 
  ADD COLUMN IF NOT EXISTS tarifa_energia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_fio_b numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_disponibilidade_monofasico numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS custo_disponibilidade_bifasico numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS custo_disponibilidade_trifasico numeric DEFAULT 100;

COMMENT ON COLUMN public.concessionarias.tarifa_energia IS 'Tarifa de energia da concessionária (R$/kWh)';
COMMENT ON COLUMN public.concessionarias.tarifa_fio_b IS 'Tarifa TUSD Fio B da concessionária (R$/kWh)';

-- ============================================================
-- 5. Campos adicionais na tabela orcamentos
-- ============================================================
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS regime_compensacao text DEFAULT 'gd2',
  ADD COLUMN IF NOT EXISTS tipo_ligacao text DEFAULT 'monofasico',
  ADD COLUMN IF NOT EXISTS concessionaria_id uuid REFERENCES public.concessionarias(id);

COMMENT ON COLUMN public.orcamentos.regime_compensacao IS 'Regime: gd1 (sem Fio B) ou gd2 (com escalonamento Lei 14.300)';
COMMENT ON COLUMN public.orcamentos.tipo_ligacao IS 'Tipo de ligação: monofasico, bifasico ou trifasico';

-- ============================================================
-- 6. Função RPC para buscar config de payback completa
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_payback_config()
RETURNS TABLE(
  custo_disponibilidade_monofasico numeric,
  custo_disponibilidade_bifasico numeric,
  custo_disponibilidade_trifasico numeric,
  taxas_fixas_mensais numeric,
  degradacao_anual_painel numeric,
  reajuste_anual_tarifa numeric,
  tarifa_fio_b_padrao numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT custo_disponibilidade_monofasico, custo_disponibilidade_bifasico,
         custo_disponibilidade_trifasico, taxas_fixas_mensais,
         degradacao_anual_painel, reajuste_anual_tarifa, tarifa_fio_b_padrao
  FROM payback_config
  LIMIT 1;
$$;

-- ============================================================
-- 7. Função RPC para buscar Fio B do ano corrente
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_fio_b_atual()
RETURNS TABLE(ano integer, percentual_nao_compensado numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.ano, f.percentual_nao_compensado
  FROM fio_b_escalonamento f
  WHERE f.ano <= EXTRACT(YEAR FROM CURRENT_DATE)::integer
  ORDER BY f.ano DESC
  LIMIT 1;
$$;

-- ============================================================
-- 8. Função RPC para buscar config tributária por estado
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_config_tributaria(_estado text)
RETURNS TABLE(
  aliquota_icms numeric,
  possui_isencao_scee boolean,
  percentual_isencao numeric,
  observacoes text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.aliquota_icms, c.possui_isencao_scee, c.percentual_isencao, c.observacoes
  FROM config_tributaria_estado c
  WHERE c.estado = _estado
  LIMIT 1;
$$;

-- Audit triggers
CREATE TRIGGER audit_fio_b_escalonamento
  AFTER INSERT OR UPDATE OR DELETE ON public.fio_b_escalonamento
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_config_tributaria_estado
  AFTER INSERT OR UPDATE OR DELETE ON public.config_tributaria_estado
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_payback_config
  AFTER INSERT OR UPDATE OR DELETE ON public.payback_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
