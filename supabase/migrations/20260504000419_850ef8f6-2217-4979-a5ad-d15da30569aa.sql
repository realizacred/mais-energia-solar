-- ═══════════════════════════════════════════════════════════════════════
-- AUDITORIA INVERSORES — FASE 1: Normalização + Garantias + Dedup
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Adicionar colunas de auditoria
ALTER TABLE public.inversores_catalogo
  ADD COLUMN IF NOT EXISTS audit_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_notes text,
  ADD COLUMN IF NOT EXISTS fabricante_original text,
  ADD COLUMN IF NOT EXISTS modelo_original text;

-- audit_status: pendente | normalizado | enriquecido | conflito | revisao_manual

-- 2. Tabela de log para rastrear mudanças (rollback se necessário)
CREATE TABLE IF NOT EXISTS public.inversores_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inversor_id uuid,
  acao text NOT NULL, -- 'normalize_fabricante','set_garantia','merge_duplicate','delete_duplicate','enrich_datasheet'
  campo text,
  valor_antes jsonb,
  valor_depois jsonb,
  motivo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inversores_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_read" ON public.inversores_audit_log FOR SELECT USING (true);
CREATE POLICY "audit_log_system_insert" ON public.inversores_audit_log FOR INSERT WITH CHECK (true);

-- 3. Backup dos valores originais antes de qualquer mudança
UPDATE public.inversores_catalogo
SET fabricante_original = fabricante, modelo_original = modelo
WHERE fabricante_original IS NULL;

-- 4. Função helper de normalização de fabricante
CREATE OR REPLACE FUNCTION public.normalize_inverter_brand(fab text)
RETURNS TABLE(brand text, series text)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  up text := UPPER(TRIM(fab));
  parts text[];
  known_brands text[] := ARRAY['DEYE','GOODWE','GROWATT','SOLIS','SAJ','FOXESS','PHB','HUAWEI','SUNGROW',
    'ENPHASE','APSYSTEMS','HOYMILES','FRONIUS','ABB','FIMER','CANADIAN SOLAR','BYD','CHINT POWER',
    'ECOSOLYS','ELGIN','HOPEWIND','HYPONTECH','INTELBRAS','INVT','KEHUA TECH','KOMECO','REFUSOL',
    'SMA','TSUNESS','WEG','ZTROON','BEDIN SOLAR','BELENERGY','HELIA','KSTAR','LIVOLTEK',
    'RENOVIGI','SOLPLANET','SOLAX','TRANNERGY','TRINA','UPSAI','SOFAR','SUNGROW','GENERAL ELECTRIC'];
  b text;
BEGIN
  FOREACH b IN ARRAY known_brands LOOP
    IF up = b OR up LIKE b || ' %' OR up LIKE b || '/%' THEN
      RETURN QUERY SELECT b, NULLIF(TRIM(REGEXP_REPLACE(up, '^' || b || '[\s/]*', '')), '');
      RETURN;
    END IF;
  END LOOP;
  RETURN QUERY SELECT up, NULL::text;
END;
$$;

-- 5. Aplicar normalização: fabricante UPPERCASE + mover série para modelo
WITH normalized AS (
  SELECT i.id, i.fabricante, i.modelo, n.brand, n.series
  FROM public.inversores_catalogo i,
       LATERAL public.normalize_inverter_brand(i.fabricante) n
  WHERE i.fabricante <> n.brand OR n.series IS NOT NULL
)
UPDATE public.inversores_catalogo i
SET fabricante = n.brand,
    modelo = CASE 
      WHEN n.series IS NOT NULL AND POSITION(n.series IN UPPER(i.modelo)) = 0
        THEN n.series || ' ' || i.modelo
      ELSE i.modelo
    END,
    audit_status = 'normalizado',
    audited_at = now()
FROM normalized n
WHERE i.id = n.id;

-- Log normalizações
INSERT INTO public.inversores_audit_log (inversor_id, acao, campo, valor_antes, valor_depois, motivo)
SELECT id, 'normalize_fabricante', 'fabricante',
  jsonb_build_object('fabricante', fabricante_original, 'modelo', modelo_original),
  jsonb_build_object('fabricante', fabricante, 'modelo', modelo),
  'UPPERCASE + sufixo de série movido para modelo'
FROM public.inversores_catalogo
WHERE audit_status = 'normalizado' AND (fabricante <> fabricante_original OR modelo <> modelo_original);

-- 6. Garantias padrão por fabricante (oficiais Brasil 2024-2025)
WITH garantias_padrao AS (
  SELECT * FROM (VALUES
    ('DEYE', 10),('GOODWE', 10),('GROWATT', 10),('SOLIS', 10),('SAJ', 10),
    ('FOXESS', 10),('PHB', 10),('HUAWEI', 10),('SUNGROW', 10),
    ('ENPHASE', 25),('APSYSTEMS', 12),('HOYMILES', 12),
    ('FRONIUS', 10),('SMA', 10),('CANADIAN SOLAR', 10),('SOFAR', 10),('SOLPLANET', 10),
    ('REFUSOL', 7),('CHINT POWER', 5),('ABB', 5),('FIMER', 5),('TSUNESS', 12),
    ('RENOVIGI', 10),('LIVOLTEK', 10)
  ) AS t(fab, anos)
)
UPDATE public.inversores_catalogo i
SET garantia_anos = g.anos,
    audit_notes = COALESCE(audit_notes||' | ','') || 'Garantia ajustada para padrão oficial: ' || g.anos || ' anos'
FROM garantias_padrao g
WHERE i.fabricante = g.fab AND COALESCE(i.garantia_anos, 0) <> g.anos;

-- Log garantias
INSERT INTO public.inversores_audit_log (inversor_id, acao, campo, valor_depois, motivo)
SELECT id, 'set_garantia', 'garantia_anos',
  jsonb_build_object('garantia_anos', garantia_anos),
  'Aplicada garantia oficial do fabricante'
FROM public.inversores_catalogo
WHERE audit_notes LIKE '%Garantia ajustada%';

-- 7. Identificar e remover duplicados (mesmo fabricante + modelo, case-insensitive)
-- Mantém: o mais completo (com datasheet > sem; ativo > inativo; mais antigo)
WITH ranked AS (
  SELECT id, fabricante, UPPER(TRIM(modelo)) AS mod_norm,
    ROW_NUMBER() OVER (
      PARTITION BY fabricante, UPPER(TRIM(modelo))
      ORDER BY 
        (datasheet_url IS NOT NULL)::int DESC,
        ativo::int DESC,
        (potencia_nominal_kw IS NOT NULL)::int DESC,
        created_at ASC
    ) AS rn
  FROM public.inversores_catalogo
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
INSERT INTO public.inversores_audit_log (inversor_id, acao, motivo, valor_antes)
SELECT i.id, 'delete_duplicate', 
  'Duplicado de mesmo fabricante+modelo removido',
  to_jsonb(i.*)
FROM public.inversores_catalogo i
WHERE i.id IN (SELECT id FROM to_delete);

DELETE FROM public.inversores_catalogo
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY fabricante, UPPER(TRIM(modelo))
      ORDER BY 
        (datasheet_url IS NOT NULL)::int DESC,
        ativo::int DESC,
        (potencia_nominal_kw IS NOT NULL)::int DESC,
        created_at ASC
    ) AS rn FROM public.inversores_catalogo
  ) r WHERE rn > 1
);

-- 8. Marcar candidatos a re-auditoria via datasheet (sem datasheet_url ou specs incompletas)
UPDATE public.inversores_catalogo
SET audit_status = CASE
  WHEN datasheet_url IS NULL THEN 'pendente_datasheet'
  WHEN potencia_nominal_kw IS NULL OR eficiencia_max_percent IS NULL OR mppt_count IS NULL 
    THEN 'specs_incompletas'
  ELSE 'normalizado'
END
WHERE audit_status IN ('pendente','normalizado');

CREATE INDEX IF NOT EXISTS idx_inv_audit_status ON public.inversores_catalogo(audit_status);
CREATE INDEX IF NOT EXISTS idx_inv_audit_log_inv ON public.inversores_audit_log(inversor_id);