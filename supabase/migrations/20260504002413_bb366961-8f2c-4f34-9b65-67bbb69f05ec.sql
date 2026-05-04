
-- Fix: propostas únicas sem is_principal não propagam valor para deal/kanban
-- 1) Auto-marcar como principal quando é a única proposta do projeto
-- 2) Backfill: sincronizar deal/projeto a partir da versão mais recente

-- Atualiza is_principal=true em propostas que são as únicas do projeto e nenhuma está marcada
WITH unicas AS (
  SELECT pn.id, pn.projeto_id
  FROM public.propostas_nativas pn
  WHERE pn.projeto_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.propostas_nativas pn2
      WHERE pn2.projeto_id = pn.projeto_id AND pn2.is_principal = true
    )
    AND (
      SELECT COUNT(*) FROM public.propostas_nativas pn3
      WHERE pn3.projeto_id = pn.projeto_id
    ) = 1
)
UPDATE public.propostas_nativas pn
SET is_principal = true, updated_at = now()
FROM unicas u
WHERE pn.id = u.id;

-- Re-sincronizar todas as principais (chama o sync existente)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.propostas_nativas WHERE is_principal = true AND projeto_id IS NOT NULL
  LOOP
    PERFORM public.sync_proposta_to_projeto_deal(r.id);
  END LOOP;
END $$;

-- Reforço do trigger: garantir is_principal automático ao inserir/atualizar quando é a única
CREATE OR REPLACE FUNCTION public.auto_mark_unique_proposta_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.projeto_id IS NULL THEN RETURN NEW; END IF;
  -- Se ainda não há principal para o projeto, marcar esta como principal
  IF NOT EXISTS (
    SELECT 1 FROM public.propostas_nativas
    WHERE projeto_id = NEW.projeto_id
      AND is_principal = true
      AND id <> NEW.id
  ) THEN
    NEW.is_principal := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_mark_unique_proposta_principal ON public.propostas_nativas;
CREATE TRIGGER trg_auto_mark_unique_proposta_principal
BEFORE INSERT OR UPDATE OF projeto_id ON public.propostas_nativas
FOR EACH ROW EXECUTE FUNCTION public.auto_mark_unique_proposta_principal();
