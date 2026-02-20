
-- ===========================================
-- Módulos Solares: Novos campos + Governança
-- ===========================================

-- 1) Novos campos técnicos
ALTER TABLE public.modulos_solares
  ADD COLUMN IF NOT EXISTS num_celulas integer,
  ADD COLUMN IF NOT EXISTS tensao_sistema text DEFAULT '1500V',
  ADD COLUMN IF NOT EXISTS profundidade_mm integer,
  ADD COLUMN IF NOT EXISTS bifacial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_coeff_pmax numeric,
  ADD COLUMN IF NOT EXISTS temp_coeff_voc numeric,
  ADD COLUMN IF NOT EXISTS temp_coeff_isc numeric,
  ADD COLUMN IF NOT EXISTS area_m2 numeric GENERATED ALWAYS AS (
    CASE WHEN comprimento_mm IS NOT NULL AND largura_mm IS NOT NULL
         THEN ROUND((comprimento_mm::numeric * largura_mm::numeric) / 1000000.0, 4)
         ELSE NULL END
  ) STORED;

-- 2) Governança: status do módulo
ALTER TABLE public.modulos_solares
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho'
    CONSTRAINT modulos_solares_status_check CHECK (status IN ('rascunho', 'revisao', 'publicado'));

-- 3) Datasheet
ALTER TABLE public.modulos_solares
  ADD COLUMN IF NOT EXISTS datasheet_url text,
  ADD COLUMN IF NOT EXISTS datasheet_source_url text,
  ADD COLUMN IF NOT EXISTS datasheet_found_at timestamptz;

-- 4) Constraint de unicidade para prevenir duplicatas
ALTER TABLE public.modulos_solares
  ADD CONSTRAINT modulos_solares_fab_modelo_potencia_key
    UNIQUE (fabricante, modelo, potencia_wp);

-- 5) Índices para filtros comuns
CREATE INDEX IF NOT EXISTS idx_modulos_solares_status ON public.modulos_solares (status);
CREATE INDEX IF NOT EXISTS idx_modulos_solares_tipo_celula ON public.modulos_solares (tipo_celula);
CREATE INDEX IF NOT EXISTS idx_modulos_solares_bifacial ON public.modulos_solares (bifacial);
CREATE INDEX IF NOT EXISTS idx_modulos_solares_tensao_sistema ON public.modulos_solares (tensao_sistema);

-- 6) Marcar registros existentes com dados completos como 'publicado'
UPDATE public.modulos_solares
  SET status = 'publicado'
  WHERE vmp_v IS NOT NULL AND imp_a IS NOT NULL AND voc_v IS NOT NULL AND isc_a IS NOT NULL;

-- 7) Storage bucket para datasheets (se não existir)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('module-datasheets', 'module-datasheets', true)
  ON CONFLICT (id) DO NOTHING;

-- 8) Storage policies
CREATE POLICY "Datasheets são publicamente acessíveis"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'module-datasheets');

CREATE POLICY "Usuários autenticados podem fazer upload de datasheets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'module-datasheets' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar datasheets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'module-datasheets' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar datasheets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'module-datasheets' AND auth.role() = 'authenticated');

-- 9) Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_modulos_solares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_modulos_solares_updated_at ON public.modulos_solares;
CREATE TRIGGER trg_modulos_solares_updated_at
  BEFORE UPDATE ON public.modulos_solares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modulos_solares_updated_at();
