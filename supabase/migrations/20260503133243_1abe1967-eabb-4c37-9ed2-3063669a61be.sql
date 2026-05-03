-- ============================================================
-- FASE A — tipo_projeto_solar (aditivo, reversível, idempotente)
-- ============================================================

-- 1) projetos.tipo_projeto_solar
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS tipo_projeto_solar text NOT NULL DEFAULT 'on_grid';

ALTER TABLE public.projetos
  DROP CONSTRAINT IF EXISTS projetos_tipo_projeto_solar_check;

ALTER TABLE public.projetos
  ADD CONSTRAINT projetos_tipo_projeto_solar_check
  CHECK (tipo_projeto_solar IN ('on_grid','hibrido','off_grid','ampliacao','bombeamento'));

CREATE INDEX IF NOT EXISTS idx_projetos_tipo_projeto_solar
  ON public.projetos (tenant_id, tipo_projeto_solar);

COMMENT ON COLUMN public.projetos.tipo_projeto_solar IS
  'Categoria comercial/operacional do projeto solar. Distinto de inversores.tipo_sistema (topologia técnica).';

-- 2) proposta_versoes.tipo_projeto_solar
ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS tipo_projeto_solar text NOT NULL DEFAULT 'on_grid';

ALTER TABLE public.proposta_versoes
  DROP CONSTRAINT IF EXISTS proposta_versoes_tipo_projeto_solar_check;

ALTER TABLE public.proposta_versoes
  ADD CONSTRAINT proposta_versoes_tipo_projeto_solar_check
  CHECK (tipo_projeto_solar IN ('on_grid','hibrido','off_grid','ampliacao','bombeamento'));

CREATE INDEX IF NOT EXISTS idx_proposta_versoes_tipo_projeto_solar
  ON public.proposta_versoes (tenant_id, tipo_projeto_solar);

COMMENT ON COLUMN public.proposta_versoes.tipo_projeto_solar IS
  'Snapshot imutável do tipo do projeto no momento da geração da versão.';

-- 3) Backfill de projetos: hibrido se houver itens 'bateria' em qualquer versão de qualquer proposta do projeto
WITH projetos_com_bateria AS (
  SELECT DISTINCT pn.projeto_id
  FROM public.propostas_nativas pn
  JOIN public.proposta_versoes pv ON pv.proposta_id = pn.id
  JOIN public.proposta_kits pk    ON pk.versao_id = pv.id
  JOIN public.proposta_kit_itens pki ON pki.kit_id = pk.id
  WHERE pki.categoria = 'bateria'
    AND pn.projeto_id IS NOT NULL
)
UPDATE public.projetos p
   SET tipo_projeto_solar = 'hibrido'
  FROM projetos_com_bateria pcb
 WHERE p.id = pcb.projeto_id
   AND p.tipo_projeto_solar = 'on_grid';

-- 4) Backfill de proposta_versoes: hibrido se a versão tem bateria
WITH versoes_com_bateria AS (
  SELECT DISTINCT pv.id AS versao_id
  FROM public.proposta_versoes pv
  JOIN public.proposta_kits pk ON pk.versao_id = pv.id
  JOIN public.proposta_kit_itens pki ON pki.kit_id = pk.id
  WHERE pki.categoria = 'bateria'
)
UPDATE public.proposta_versoes pv
   SET tipo_projeto_solar = 'hibrido'
  FROM versoes_com_bateria vcb
 WHERE pv.id = vcb.versao_id
   AND pv.tipo_projeto_solar = 'on_grid';

-- 5) Trigger: ao inserir nova versão, herda tipo do projeto vinculado
CREATE OR REPLACE FUNCTION public.trg_proposta_versao_inherit_tipo_projeto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_tipo text;
BEGIN
  -- Só herda se chamador não definiu explicitamente
  IF NEW.tipo_projeto_solar IS NULL OR NEW.tipo_projeto_solar = 'on_grid' THEN
    SELECT pr.tipo_projeto_solar
      INTO v_projeto_tipo
      FROM public.propostas_nativas pn
      JOIN public.projetos pr ON pr.id = pn.projeto_id
     WHERE pn.id = NEW.proposta_id
     LIMIT 1;

    IF v_projeto_tipo IS NOT NULL THEN
      NEW.tipo_projeto_solar := v_projeto_tipo;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proposta_versao_inherit_tipo ON public.proposta_versoes;
CREATE TRIGGER trg_proposta_versao_inherit_tipo
  BEFORE INSERT ON public.proposta_versoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proposta_versao_inherit_tipo_projeto();

-- 6) Relatório de impacto (apenas para o log da migração)
DO $$
DECLARE
  v_proj_hibrido int;
  v_vers_hibrido int;
  v_proj_total int;
  v_vers_total int;
BEGIN
  SELECT count(*) INTO v_proj_total FROM public.projetos;
  SELECT count(*) INTO v_proj_hibrido FROM public.projetos WHERE tipo_projeto_solar='hibrido';
  SELECT count(*) INTO v_vers_total FROM public.proposta_versoes;
  SELECT count(*) INTO v_vers_hibrido FROM public.proposta_versoes WHERE tipo_projeto_solar='hibrido';

  RAISE NOTICE 'BACKFILL Fase A — projetos: % híbridos de % total | versoes: % híbridos de % total',
    v_proj_hibrido, v_proj_total, v_vers_hibrido, v_vers_total;
END $$;