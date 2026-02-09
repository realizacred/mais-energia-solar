-- ═══════════════════════════════════════════════════════════
-- MÓDULOS FOTOVOLTAICOS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.modulos_fotovoltaicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  potencia_w NUMERIC NOT NULL,
  tipo_celula TEXT,
  numero_celulas INTEGER,
  dimensoes_mm TEXT,
  tensao_sistema_v NUMERIC,
  vmp NUMERIC,
  imp NUMERIC,
  voc NUMERIC,
  isc NUMERIC,
  coef_temp TEXT,
  eficiencia_percent TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modulos_fotovoltaicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read modulos"
  ON public.modulos_fotovoltaicos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert modulos"
  ON public.modulos_fotovoltaicos FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update modulos"
  ON public.modulos_fotovoltaicos FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete modulos"
  ON public.modulos_fotovoltaicos FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_modulos_updated_at
  BEFORE UPDATE ON public.modulos_fotovoltaicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_modulos_ativo ON public.modulos_fotovoltaicos (ativo);

-- ═══════════════════════════════════════════════════════════
-- INVERSORES
-- ═══════════════════════════════════════════════════════════
CREATE TYPE public.tipo_sistema_inversor AS ENUM ('ON_GRID', 'HIBRIDO', 'OFF_GRID');

CREATE TABLE public.inversores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  potencia_nominal_w NUMERIC NOT NULL,
  potencia_maxima_w NUMERIC,
  mppts INTEGER,
  tensao_max_v NUMERIC,
  tensao_min_mppt_v NUMERIC,
  tensao_max_mppt_v NUMERIC,
  corrente_max_mppt_a NUMERIC,
  tensao_linha_v NUMERIC,
  eficiencia_percent TEXT,
  tipo_sistema public.tipo_sistema_inversor NOT NULL DEFAULT 'ON_GRID',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inversores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inversores"
  ON public.inversores FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert inversores"
  ON public.inversores FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update inversores"
  ON public.inversores FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete inversores"
  ON public.inversores FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_inversores_updated_at
  BEFORE UPDATE ON public.inversores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_inversores_ativo ON public.inversores (ativo);

-- ═══════════════════════════════════════════════════════════
-- BATERIAS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.baterias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tipo_bateria TEXT,
  energia_kwh NUMERIC,
  dimensoes_mm TEXT,
  tensao_operacao_v TEXT,
  tensao_carga_v NUMERIC,
  tensao_nominal_v NUMERIC,
  potencia_max_saida_kw NUMERIC,
  corrente_max_descarga_a NUMERIC,
  corrente_max_carga_a NUMERIC,
  correntes_recomendadas_a TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.baterias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read baterias"
  ON public.baterias FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert baterias"
  ON public.baterias FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update baterias"
  ON public.baterias FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete baterias"
  ON public.baterias FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_baterias_updated_at
  BEFORE UPDATE ON public.baterias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_baterias_ativo ON public.baterias (ativo);

-- ═══════════════════════════════════════════════════════════
-- PROPOSAL VARIABLES (structure for future proposal generation)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.proposal_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposal_variables"
  ON public.proposal_variables FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage proposal_variables"
  ON public.proposal_variables FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_proposal_variables_updated_at
  BEFORE UPDATE ON public.proposal_variables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_proposal_variables_proposta ON public.proposal_variables (proposta_id);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA (examples from the request)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.modulos_fotovoltaicos (fabricante, modelo, potencia_w, tipo_celula, numero_celulas, dimensoes_mm, tensao_sistema_v, vmp, imp, voc, isc, coef_temp, eficiencia_percent)
VALUES ('AE SOLAR', 'AE340M6-72', 340, 'MONOCRISTALINO', 72, '1956x992x40mm', 1000, 39.09, 8.7, 46.94, 9.48, '-0.0038 / -0.0029 / 0.0005', '17,52%');

INSERT INTO public.inversores (fabricante, modelo, potencia_nominal_w, potencia_maxima_w, mppts, tensao_max_v, tensao_min_mppt_v, tensao_max_mppt_v, corrente_max_mppt_a, tensao_linha_v, eficiencia_percent, tipo_sistema)
VALUES ('ABB', 'ABB PRO 33.0-TL-OUTD-SX-400 - Trifasico 380V', 33000, 33000, 1, 1100, 580, 950, 80, 380, '98,30%', 'ON_GRID');

INSERT INTO public.baterias (fabricante, modelo, tipo_bateria, energia_kwh, dimensoes_mm, tensao_operacao_v, tensao_carga_v, tensao_nominal_v, potencia_max_saida_kw, corrente_max_descarga_a, corrente_max_carga_a)
VALUES ('UNIPOWER', 'UPLFP48-100 3U', 'Baterias de Íon-Lítio', 5, '390x442x140mm', '42 ~ 54', 0, 48, 0, 100, 100);