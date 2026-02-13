
-- =============================================
-- CATÁLOGO DE MÓDULOS SOLARES (PLACAS)
-- Híbrido: tenant_id NULL = global, UUID = customizado
-- =============================================
CREATE TABLE public.modulos_solares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  potencia_wp INTEGER NOT NULL,
  tipo_celula TEXT NOT NULL DEFAULT 'Mono PERC',
  eficiencia_percent NUMERIC(5,2),
  comprimento_mm INTEGER,
  largura_mm INTEGER,
  peso_kg NUMERIC(6,2),
  garantia_produto_anos INTEGER DEFAULT 12,
  garantia_performance_anos INTEGER DEFAULT 25,
  voc_v NUMERIC(6,2),
  isc_a NUMERIC(6,2),
  vmp_v NUMERIC(6,2),
  imp_a NUMERIC(6,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_modulos_solares_fabricante ON public.modulos_solares(fabricante);
CREATE INDEX idx_modulos_solares_tenant ON public.modulos_solares(tenant_id);
CREATE INDEX idx_modulos_solares_potencia ON public.modulos_solares(potencia_wp);

ALTER TABLE public.modulos_solares ENABLE ROW LEVEL SECURITY;

-- Leitura: globais (tenant_id IS NULL) + próprios do tenant
CREATE POLICY "Ler módulos globais e do tenant"
ON public.modulos_solares FOR SELECT
USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

-- Insert: apenas no próprio tenant
CREATE POLICY "Inserir módulos no próprio tenant"
ON public.modulos_solares FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Update: apenas do próprio tenant (nunca globais)
CREATE POLICY "Atualizar módulos do próprio tenant"
ON public.modulos_solares FOR UPDATE
USING (tenant_id = get_user_tenant_id());

-- Delete: apenas do próprio tenant
CREATE POLICY "Deletar módulos do próprio tenant"
ON public.modulos_solares FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_modulos_solares_updated_at
BEFORE UPDATE ON public.modulos_solares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CATÁLOGO DE INVERSORES
-- =============================================
CREATE TABLE public.inversores_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  potencia_nominal_kw NUMERIC(8,2) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'String',
  tensao_entrada_max_v INTEGER,
  corrente_entrada_max_a NUMERIC(6,2),
  mppt_count INTEGER DEFAULT 2,
  strings_por_mppt INTEGER DEFAULT 1,
  fases TEXT NOT NULL DEFAULT 'Monofásico',
  tensao_saida_v INTEGER DEFAULT 220,
  eficiencia_max_percent NUMERIC(5,2),
  garantia_anos INTEGER DEFAULT 5,
  peso_kg NUMERIC(6,2),
  dimensoes_mm TEXT,
  wifi_integrado BOOLEAN DEFAULT false,
  ip_protection TEXT DEFAULT 'IP65',
  ativo BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inversores_catalogo_fabricante ON public.inversores_catalogo(fabricante);
CREATE INDEX idx_inversores_catalogo_tenant ON public.inversores_catalogo(tenant_id);
CREATE INDEX idx_inversores_catalogo_potencia ON public.inversores_catalogo(potencia_nominal_kw);

ALTER TABLE public.inversores_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ler inversores globais e do tenant"
ON public.inversores_catalogo FOR SELECT
USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

CREATE POLICY "Inserir inversores no próprio tenant"
ON public.inversores_catalogo FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Atualizar inversores do próprio tenant"
ON public.inversores_catalogo FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Deletar inversores do próprio tenant"
ON public.inversores_catalogo FOR DELETE
USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_inversores_catalogo_updated_at
BEFORE UPDATE ON public.inversores_catalogo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED: MÓDULOS SOLARES (Global - tenant_id NULL)
-- =============================================
INSERT INTO public.modulos_solares (fabricante, modelo, potencia_wp, tipo_celula, eficiencia_percent, comprimento_mm, largura_mm, peso_kg, garantia_produto_anos, garantia_performance_anos) VALUES
-- Canadian Solar
('Canadian Solar', 'CS7L-600MS', 600, 'Mono PERC', 21.40, 2172, 1303, 34.4, 12, 25),
('Canadian Solar', 'CS7N-665MS', 665, 'Mono PERC HiKu7', 21.65, 2384, 1303, 37.2, 12, 25),
('Canadian Solar', 'CS6R-420MS', 420, 'Mono PERC', 21.30, 1722, 1134, 21.0, 12, 25),
('Canadian Solar', 'CS3W-460MS', 460, 'Mono PERC HiKu', 20.90, 2108, 1048, 24.9, 12, 25),
('Canadian Solar', 'CS7N-700MS', 700, 'TOPCon HiKu7', 22.50, 2384, 1303, 37.8, 15, 30),

-- Trina Solar
('Trina Solar', 'TSM-DE09R.08 430W', 430, 'Mono PERC', 21.30, 1762, 1134, 21.8, 15, 25),
('Trina Solar', 'TSM-NEG9R.28 580W', 580, 'N-Type TOPCon', 22.40, 2278, 1134, 28.0, 15, 30),
('Trina Solar', 'TSM-NEG21C.20 670W', 670, 'N-Type TOPCon Vertex', 22.50, 2384, 1303, 37.0, 15, 30),
('Trina Solar', 'TSM-DE21 600W', 600, 'Mono PERC Vertex', 21.60, 2172, 1303, 34.0, 12, 25),
('Trina Solar', 'TSM-NEG9RC.27 440W', 440, 'N-Type TOPCon', 22.30, 1762, 1134, 22.0, 15, 30),

-- JA Solar
('JA Solar', 'JAM72S30-540/MR', 540, 'Mono PERC', 20.90, 2278, 1134, 28.8, 12, 25),
('JA Solar', 'JAM78S30-610/MR', 610, 'Mono PERC', 21.30, 2465, 1134, 32.0, 12, 25),
('JA Solar', 'JAM72D40-580/LB', 580, 'N-Type TOPCon', 22.40, 2278, 1134, 28.5, 15, 30),
('JA Solar', 'JAM54S30-420/MR', 420, 'Mono PERC', 21.30, 1722, 1134, 21.0, 12, 25),
('JA Solar', 'JAM66D45-660/LB', 660, 'N-Type TOPCon', 22.60, 2384, 1303, 36.5, 15, 30),

-- Jinko Solar
('Jinko Solar', 'JKM575N-72HL4-V', 575, 'N-Type TOPCon Tiger Neo', 22.26, 2278, 1134, 28.0, 15, 30),
('Jinko Solar', 'JKM470M-60HL4-V', 470, 'Mono PERC Tiger Pro', 21.72, 1903, 1134, 24.5, 12, 25),
('Jinko Solar', 'JKM665N-78HL4-BDV', 665, 'N-Type TOPCon Bifacial', 22.53, 2384, 1303, 37.0, 15, 30),
('Jinko Solar', 'JKM430M-54HL4-V', 430, 'Mono PERC', 21.50, 1722, 1134, 21.5, 12, 25),
('Jinko Solar', 'JKM620N-78HL4-V', 620, 'N-Type TOPCon', 22.30, 2465, 1134, 32.5, 15, 30),

-- LONGi
('LONGi', 'LR5-72HPH-545M', 545, 'Mono PERC Hi-MO 5', 21.10, 2256, 1133, 28.6, 12, 25),
('LONGi', 'LR5-72HTH-580M', 580, 'N-Type HPBC Hi-MO 7', 22.50, 2278, 1134, 28.5, 15, 30),
('LONGi', 'LR5-54HTH-435M', 435, 'N-Type HPBC', 22.30, 1722, 1134, 21.8, 15, 30),
('LONGi', 'LR7-72HGD-670M', 670, 'N-Type HPBC Hi-MO X6', 22.80, 2384, 1303, 36.8, 15, 30),
('LONGi', 'LR5-72HPH-555M', 555, 'Mono PERC', 21.50, 2256, 1133, 28.8, 12, 25),

-- BYD
('BYD', 'BYD440PHK-36GS-V', 440, 'Mono PERC', 21.60, 1762, 1134, 22.0, 12, 25),
('BYD', 'BYD550PHK-36VS-V', 550, 'Mono PERC', 21.30, 2278, 1134, 28.5, 12, 25),
('BYD', 'BYD665NHK-36GV', 665, 'N-Type TOPCon', 22.40, 2384, 1303, 37.0, 15, 30),

-- Risen
('Risen', 'RSM40-8-410M', 410, 'Mono PERC', 21.10, 1722, 1134, 21.0, 12, 25),
('Risen', 'RSM144-10-595BNDG', 595, 'N-Type TOPCon HJT', 22.30, 2384, 1134, 33.0, 15, 30),
('Risen', 'RSM132-8-665N', 665, 'N-Type TOPCon', 22.50, 2384, 1303, 37.0, 15, 30),

-- DAH Solar
('DAH Solar', 'DHN-54X16/FS 435W', 435, 'N-Type TOPCon', 22.18, 1762, 1134, 22.0, 15, 30),
('DAH Solar', 'DHN-72X16/FS 580W', 580, 'N-Type TOPCon', 22.40, 2278, 1134, 28.5, 15, 30),
('DAH Solar', 'DHM-60X10 460W', 460, 'Mono PERC', 21.30, 1903, 1134, 24.0, 12, 25),

-- Astronergy (CHINT)
('Astronergy', 'ASTRO N5 435W', 435, 'N-Type TOPCon', 22.20, 1762, 1134, 21.8, 15, 30),
('Astronergy', 'ASTRO N7 580W', 580, 'N-Type TOPCon', 22.50, 2278, 1134, 28.3, 15, 30),
('Astronergy', 'ASTRO N7 670W', 670, 'N-Type TOPCon', 22.60, 2384, 1303, 36.8, 15, 30),

-- Yingli
('Yingli', 'YLM-420 PANDA 3.0', 420, 'Mono PERC', 21.00, 1722, 1134, 21.5, 12, 25),
('Yingli', 'YLM-550 PANDA 3.0', 550, 'Mono PERC', 21.20, 2278, 1134, 28.5, 12, 25),

-- OSDA
('OSDA', 'ODA550-36-MH', 550, 'Mono PERC', 21.30, 2278, 1134, 28.5, 12, 25),
('OSDA', 'ODA440-36V-MH', 440, 'Mono PERC', 21.50, 1762, 1134, 22.0, 12, 25),

-- Leapton
('Leapton', 'LP182-M-54-MH 420W', 420, 'Mono PERC', 21.20, 1722, 1134, 21.0, 12, 25),
('Leapton', 'LP210-M-66-MH 580W', 580, 'Mono PERC', 21.50, 2384, 1134, 31.5, 12, 25),

-- ZNSHINE
('ZNShine', 'ZXM7-NHLDD144 580W', 580, 'N-Type TOPCon', 22.30, 2278, 1134, 28.5, 15, 30),

-- Ulica Solar
('Ulica Solar', 'UL-440M-144HV', 440, 'Mono PERC', 21.30, 2024, 1004, 23.5, 12, 25);

-- =============================================
-- SEED: INVERSORES (Global - tenant_id NULL)
-- =============================================
INSERT INTO public.inversores_catalogo (fabricante, modelo, potencia_nominal_kw, tipo, tensao_entrada_max_v, mppt_count, strings_por_mppt, fases, eficiencia_max_percent, garantia_anos, peso_kg, wifi_integrado) VALUES
-- Growatt
('Growatt', 'MIN 3000TL-XH', 3.00, 'String', 500, 1, 1, 'Monofásico', 97.60, 5, 9.5, true),
('Growatt', 'MIN 5000TL-XH', 5.00, 'String', 500, 2, 1, 'Monofásico', 97.80, 5, 12.5, true),
('Growatt', 'MIN 6000TL-XH', 6.00, 'String', 500, 2, 1, 'Monofásico', 97.80, 5, 12.5, true),
('Growatt', 'MIN 8000TL-XH', 8.00, 'String', 500, 2, 1, 'Monofásico', 98.00, 5, 14.5, true),
('Growatt', 'MOD 5000TL3-XH', 5.00, 'String', 550, 2, 1, 'Trifásico', 98.20, 5, 14.0, true),
('Growatt', 'MOD 8000TL3-XH', 8.00, 'String', 550, 2, 2, 'Trifásico', 98.40, 5, 14.5, true),
('Growatt', 'MOD 10KTL3-XH', 10.00, 'String', 550, 2, 2, 'Trifásico', 98.40, 5, 17.0, true),
('Growatt', 'MOD 15KTL3-XH', 15.00, 'String', 1100, 2, 2, 'Trifásico', 98.60, 5, 24.0, true),
('Growatt', 'MAC 25KTL3-X', 25.00, 'String', 1100, 3, 2, 'Trifásico', 98.80, 5, 32.0, true),
('Growatt', 'MAC 50KTL3-X LV', 50.00, 'String', 1100, 5, 2, 'Trifásico', 98.80, 5, 55.0, true),

-- Solis
('Solis', 'S6-GR1P3K', 3.00, 'String', 500, 1, 1, 'Monofásico', 97.70, 5, 8.0, true),
('Solis', 'S6-GR1P5K', 5.00, 'String', 500, 2, 1, 'Monofásico', 97.80, 5, 10.5, true),
('Solis', 'S6-GR1P8K', 8.00, 'String', 600, 2, 1, 'Monofásico', 98.00, 5, 13.0, true),
('Solis', 'S6-GR3P5K', 5.00, 'String', 600, 2, 1, 'Trifásico', 98.00, 5, 12.0, true),
('Solis', 'S6-GR3P10K', 10.00, 'String', 600, 2, 2, 'Trifásico', 98.40, 5, 17.0, true),
('Solis', 'S6-GR3P15K', 15.00, 'String', 1100, 2, 2, 'Trifásico', 98.50, 5, 23.0, true),
('Solis', 'S6-GR3P25K', 25.00, 'String', 1100, 3, 2, 'Trifásico', 98.80, 5, 30.0, true),

-- Deye
('Deye', 'SUN-3K-G', 3.00, 'String', 500, 1, 1, 'Monofásico', 97.50, 5, 9.0, true),
('Deye', 'SUN-5K-G', 5.00, 'String', 500, 2, 1, 'Monofásico', 97.80, 5, 11.0, true),
('Deye', 'SUN-8K-G', 8.00, 'String', 500, 2, 1, 'Monofásico', 98.00, 5, 13.5, true),
('Deye', 'SUN-5K-G3', 5.00, 'String', 550, 2, 1, 'Trifásico', 98.00, 5, 12.5, true),
('Deye', 'SUN-10K-G3', 10.00, 'String', 550, 2, 2, 'Trifásico', 98.40, 5, 16.5, true),
('Deye', 'SUN-12K-SG04LP3', 12.00, 'Híbrido', 550, 2, 2, 'Trifásico', 97.60, 5, 25.0, true),
('Deye', 'SUN-15K-G3', 15.00, 'String', 1100, 2, 2, 'Trifásico', 98.50, 5, 22.0, true),
('Deye', 'SUN-25K-G3', 25.00, 'String', 1100, 3, 2, 'Trifásico', 98.70, 5, 30.0, true),
('Deye', 'SUN-50K-G3', 50.00, 'String', 1100, 5, 2, 'Trifásico', 98.80, 5, 52.0, true),

-- Huawei
('Huawei', 'SUN2000-3KTL-L1', 3.00, 'String', 600, 2, 1, 'Monofásico', 98.40, 10, 10.0, true),
('Huawei', 'SUN2000-5KTL-L1', 5.00, 'String', 600, 2, 1, 'Monofásico', 98.60, 10, 11.0, true),
('Huawei', 'SUN2000-8KTL-M1', 8.00, 'String', 600, 2, 2, 'Monofásico', 98.60, 10, 12.5, true),
('Huawei', 'SUN2000-5KTL-M1', 5.00, 'String', 600, 2, 1, 'Trifásico', 98.60, 10, 12.0, true),
('Huawei', 'SUN2000-10KTL-M1', 10.00, 'String', 1080, 2, 2, 'Trifásico', 98.60, 10, 14.5, true),
('Huawei', 'SUN2000-15KTL-M2', 15.00, 'String', 1080, 2, 2, 'Trifásico', 98.70, 10, 17.0, true),
('Huawei', 'SUN2000-20KTL-M2', 20.00, 'String', 1080, 2, 3, 'Trifásico', 98.70, 10, 19.5, true),
('Huawei', 'SUN2000-36KTL-M3', 36.00, 'String', 1100, 4, 2, 'Trifásico', 98.80, 10, 37.0, true),

-- Fronius
('Fronius', 'Primo GEN24 3.0', 3.00, 'Híbrido', 600, 2, 1, 'Monofásico', 98.00, 5, 16.0, true),
('Fronius', 'Primo GEN24 6.0', 6.00, 'Híbrido', 600, 2, 1, 'Monofásico', 98.20, 5, 18.0, true),
('Fronius', 'Symo GEN24 10.0', 10.00, 'Híbrido', 1000, 2, 2, 'Trifásico', 98.20, 5, 22.0, true),
('Fronius', 'Tauro 50-3-P', 50.00, 'String', 1000, 6, 3, 'Trifásico', 98.70, 5, 51.5, true),

-- Goodwe
('Goodwe', 'GW3000-NS', 3.00, 'String', 500, 1, 1, 'Monofásico', 97.60, 5, 10.0, true),
('Goodwe', 'GW5000-NS', 5.00, 'String', 500, 2, 1, 'Monofásico', 97.80, 5, 12.0, true),
('Goodwe', 'GW8000-DT', 8.00, 'String', 580, 2, 1, 'Trifásico', 98.00, 5, 14.0, true),
('Goodwe', 'GW10K-DT', 10.00, 'String', 580, 2, 2, 'Trifásico', 98.40, 5, 16.0, true),
('Goodwe', 'GW25K-DT', 25.00, 'String', 1000, 3, 2, 'Trifásico', 98.60, 5, 32.0, true),

-- SAJ
('SAJ', 'R5-3K-S1', 3.00, 'String', 500, 1, 1, 'Monofásico', 97.50, 5, 8.5, true),
('SAJ', 'R5-5K-S2', 5.00, 'String', 550, 2, 1, 'Monofásico', 97.80, 5, 10.5, true),
('SAJ', 'R5-8K-T2', 8.00, 'String', 550, 2, 1, 'Trifásico', 98.00, 5, 13.0, true),
('SAJ', 'R5-15K-T2', 15.00, 'String', 1000, 2, 2, 'Trifásico', 98.40, 5, 22.0, true),
('SAJ', 'R5-25K-T2', 25.00, 'String', 1000, 3, 2, 'Trifásico', 98.60, 5, 30.0, true),

-- SMA
('SMA', 'Sunny Boy 3.0', 3.00, 'String', 600, 1, 1, 'Monofásico', 97.20, 5, 16.0, true),
('SMA', 'Sunny Boy 5.0', 5.00, 'String', 600, 2, 1, 'Monofásico', 97.40, 5, 17.0, true),
('SMA', 'Sunny Tripower 8.0', 8.00, 'String', 1000, 2, 2, 'Trifásico', 98.00, 5, 29.0, true),
('SMA', 'Sunny Tripower 15000TL', 15.00, 'String', 1000, 2, 2, 'Trifásico', 98.40, 5, 33.0, true),
('SMA', 'Sunny Tripower 25000TL', 25.00, 'String', 1000, 2, 3, 'Trifásico', 98.60, 5, 61.0, true),

-- Enphase (Microinversores)
('Enphase', 'IQ7+', 0.29, 'Microinversor', 60, 1, 1, 'Monofásico', 97.50, 25, 1.08, true),
('Enphase', 'IQ7A', 0.35, 'Microinversor', 60, 1, 1, 'Monofásico', 97.50, 25, 1.08, true),
('Enphase', 'IQ8+', 0.30, 'Microinversor', 60, 1, 1, 'Monofásico', 97.50, 25, 1.08, true),
('Enphase', 'IQ8M', 0.33, 'Microinversor', 60, 1, 1, 'Monofásico', 97.50, 25, 1.13, true),

-- APsystems (Microinversores)
('APsystems', 'DS3', 0.73, 'Microinversor', 65, 2, 1, 'Monofásico', 96.50, 12, 3.0, true),
('APsystems', 'QT2', 1.50, 'Microinversor', 65, 4, 1, 'Trifásico', 96.70, 12, 5.5, true),

-- ABB/FIMER
('ABB/FIMER', 'UNO-DM-5.0-TL-PLUS', 5.00, 'String', 580, 2, 1, 'Monofásico', 97.40, 5, 15.0, true),
('ABB/FIMER', 'PVS-10-TL-SX', 10.00, 'String', 950, 2, 2, 'Trifásico', 98.20, 5, 25.0, true);
