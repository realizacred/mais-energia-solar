-- FASE 2: Terminalidade canônica
-- 1) Coluna em projeto_etapas
ALTER TABLE public.projeto_etapas
  ADD COLUMN IF NOT EXISTS is_terminal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projeto_etapas.is_terminal IS
  'Quando true, projetos nesta etapa são considerados terminais (fora da fila operacional, score=0). SSOT para isProjetoTerminalForOperationalQueue.';

-- 2) Backfill por nome + categoria conhecidos
UPDATE public.projeto_etapas
SET is_terminal = true
WHERE is_terminal = false
  AND (
    lower(unaccent(nome)) IN (
      'instalacao realizada',
      'sistema em operacao',
      'concluido','concluida',
      'finalizado','finalizada',
      'encerrado','encerrada',
      'homologacao aprovada',
      'ganho','perdido'
    )
    OR categoria::text IN ('ganho','perdido','excluido','concluido')
  );

-- 3) Coluna em project_operational_projection
ALTER TABLE public.project_operational_projection
  ADD COLUMN IF NOT EXISTS is_terminal boolean NOT NULL DEFAULT false;

-- 4) Backfill da projeção a partir do etapa_id do projeto
UPDATE public.project_operational_projection pop
SET is_terminal = COALESCE(pe.is_terminal, false)
FROM public.projetos p
LEFT JOIN public.projeto_etapas pe ON pe.id = p.etapa_id
WHERE pop.project_id = p.id;

-- 5) Atualizar função de refresh para propagar is_terminal
CREATE OR REPLACE FUNCTION public.refresh_project_operational_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_terminal boolean := false;
BEGIN
  IF NEW.etapa_id IS NOT NULL THEN
    SELECT COALESCE(pe.is_terminal, false) INTO v_is_terminal
    FROM public.projeto_etapas pe
    WHERE pe.id = NEW.etapa_id;
  END IF;

  INSERT INTO public.project_operational_projection (
    project_id, tenant_id, codigo, status_operacional, data_venda, potencia_kwp, is_terminal
  )
  VALUES (
    NEW.id, NEW.tenant_id, NEW.codigo, NEW.status::text, NEW.data_venda, NEW.potencia_kwp, COALESCE(v_is_terminal, false)
  )
  ON CONFLICT (project_id) DO UPDATE SET
    status_operacional = EXCLUDED.status_operacional,
    codigo             = EXCLUDED.codigo,
    data_venda         = EXCLUDED.data_venda,
    potencia_kwp       = EXCLUDED.potencia_kwp,
    is_terminal        = EXCLUDED.is_terminal,
    last_updated_at    = now();
  RETURN NEW;
END;
$function$;

-- 6) Trigger para manter projeção sincronizada quando is_terminal da etapa mudar
CREATE OR REPLACE FUNCTION public.sync_projection_is_terminal_on_etapa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_terminal IS DISTINCT FROM NEW.is_terminal THEN
    UPDATE public.project_operational_projection pop
    SET is_terminal = NEW.is_terminal,
        last_updated_at = now()
    FROM public.projetos p
    WHERE pop.project_id = p.id
      AND p.etapa_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_projection_is_terminal ON public.projeto_etapas;
CREATE TRIGGER trg_sync_projection_is_terminal
AFTER UPDATE OF is_terminal ON public.projeto_etapas
FOR EACH ROW EXECUTE FUNCTION public.sync_projection_is_terminal_on_etapa_change();

-- 7) Índice para filtragem rápida
CREATE INDEX IF NOT EXISTS idx_projeto_etapas_is_terminal
  ON public.projeto_etapas(is_terminal) WHERE is_terminal = true;