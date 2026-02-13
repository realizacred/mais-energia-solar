
-- ═══════════════════════════════════════════════════════════════
-- 1) Tabela de irradiação solar por estado (kWh/kWp/mês)
--    Fonte: CRESESB/INPE médias anuais
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.irradiacao_por_estado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estado VARCHAR(2) NOT NULL,
  geracao_media_kwp_mes NUMERIC NOT NULL DEFAULT 120,
  fonte TEXT DEFAULT 'CRESESB/INPE',
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estado, tenant_id)
);

ALTER TABLE public.irradiacao_por_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Irradiação visível para todos" ON public.irradiacao_por_estado
  FOR SELECT USING (true);

CREATE POLICY "Admin pode gerenciar irradiação" ON public.irradiacao_por_estado
  FOR ALL USING (
    tenant_id = get_user_tenant_id() 
    AND is_admin(auth.uid())
  );

-- Inserir valores padrão por estado (baseados em dados CRESESB)
-- Valores em kWh gerados por kWp instalado por mês
INSERT INTO public.irradiacao_por_estado (estado, geracao_media_kwp_mes, tenant_id) VALUES
  -- Norte (alta irradiação, mas umidade reduz)
  ('AC', 125, NULL), ('AM', 120, NULL), ('AP', 130, NULL),
  ('PA', 128, NULL), ('RO', 130, NULL), ('RR', 132, NULL), ('TO', 140, NULL),
  -- Nordeste (alta irradiação)
  ('AL', 145, NULL), ('BA', 148, NULL), ('CE', 150, NULL),
  ('MA', 135, NULL), ('PB', 152, NULL), ('PE', 148, NULL),
  ('PI', 150, NULL), ('RN', 155, NULL), ('SE', 142, NULL),
  -- Centro-Oeste (boa irradiação)
  ('DF', 138, NULL), ('GO', 140, NULL), ('MS', 138, NULL), ('MT', 142, NULL),
  -- Sudeste (variável)
  ('ES', 132, NULL), ('MG', 140, NULL), ('RJ', 125, NULL), ('SP', 120, NULL),
  -- Sul (menor irradiação)
  ('PR', 118, NULL), ('RS', 112, NULL), ('SC', 115, NULL);

-- ═══════════════════════════════════════════════════════════════
-- 2) Adicionar fator de perdas à calculadora_config
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.calculadora_config 
  ADD COLUMN IF NOT EXISTS fator_perdas_percentual NUMERIC NOT NULL DEFAULT 15;

-- Comentário: 15% = padrão mercado (cabeamento 2%, temperatura 5%, sujeira 3%, inversor 3%, mismatch 2%)

-- ═══════════════════════════════════════════════════════════════
-- 3) Tabela de custo por faixa de potência
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.custo_faixas_kwp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  faixa_min_kwp NUMERIC NOT NULL DEFAULT 0,
  faixa_max_kwp NUMERIC NOT NULL DEFAULT 999,
  custo_por_kwp NUMERIC NOT NULL DEFAULT 4500,
  descricao TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custo_faixas_kwp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faixas visíveis para tenant" ON public.custo_faixas_kwp
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admin pode gerenciar faixas" ON public.custo_faixas_kwp
  FOR ALL USING (
    tenant_id = get_user_tenant_id() 
    AND is_admin(auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 4) RPC pública para buscar irradiação (sem auth)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_irradiacao_estado(_estado TEXT, _tenant_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _val NUMERIC;
BEGIN
  -- 1) Tenant-specific override
  IF _tenant_id IS NOT NULL THEN
    SELECT geracao_media_kwp_mes INTO _val
    FROM irradiacao_por_estado
    WHERE estado = _estado AND tenant_id = _tenant_id
    LIMIT 1;
    IF _val IS NOT NULL THEN RETURN _val; END IF;
  END IF;
  
  -- 2) Default (tenant_id IS NULL)
  SELECT geracao_media_kwp_mes INTO _val
  FROM irradiacao_por_estado
  WHERE estado = _estado AND tenant_id IS NULL
  LIMIT 1;
  
  RETURN COALESCE(_val, 120); -- fallback nacional
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5) RPC para buscar concessionárias por estado (público)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_concessionarias_por_estado(_estado TEXT)
RETURNS TABLE(
  id UUID,
  nome TEXT,
  sigla TEXT,
  tarifa_energia NUMERIC,
  tarifa_fio_b NUMERIC,
  aliquota_icms NUMERIC,
  possui_isencao_scee BOOLEAN,
  percentual_isencao NUMERIC,
  custo_disponibilidade_monofasico NUMERIC,
  custo_disponibilidade_bifasico NUMERIC,
  custo_disponibilidade_trifasico NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.nome, c.sigla, c.tarifa_energia, c.tarifa_fio_b,
         c.aliquota_icms, c.possui_isencao_scee, c.percentual_isencao,
         c.custo_disponibilidade_monofasico, c.custo_disponibilidade_bifasico,
         c.custo_disponibilidade_trifasico
  FROM concessionarias c
  WHERE c.estado = _estado AND c.ativo = true
  ORDER BY c.nome;
$$;

-- Trigger para updated_at
CREATE TRIGGER update_irradiacao_updated_at
  BEFORE UPDATE ON public.irradiacao_por_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custo_faixas_updated_at
  BEFORE UPDATE ON public.custo_faixas_kwp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
