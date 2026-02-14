
-- ============================================================
-- HARDENING: Imutabilidade real + Idempotência em proposta_versoes
-- ============================================================

-- 1) Coluna snapshot_locked (proteção no banco, não só app-level)
ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS snapshot_locked BOOLEAN NOT NULL DEFAULT false;

-- 2) Coluna idempotency_key (evita duplicação por clique duplo)
ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposta_versoes_idempotency
  ON public.proposta_versoes(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) Trigger: BLOQUEAR alteração de snapshot quando locked
CREATE OR REPLACE FUNCTION public.protect_locked_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se snapshot já está trancado e alguém tenta alterar snapshot ou destravar
  IF OLD.snapshot_locked = true THEN
    -- Bloqueia qualquer mudança no snapshot
    IF NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
      RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE: snapshot não pode ser alterado após geração (versao_id=%)', OLD.id
        USING ERRCODE = 'P0460';
    END IF;
    -- Bloqueia destravamento
    IF NEW.snapshot_locked = false THEN
      RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE: snapshot_locked não pode ser revertido (versao_id=%)', OLD.id
        USING ERRCODE = 'P0460';
    END IF;
  END IF;

  -- Auto-lock: quando status sai de draft para generated, travar automaticamente
  IF OLD.status = 'draft' AND NEW.status = 'generated' THEN
    NEW.snapshot_locked := true;
    NEW.gerado_em := COALESCE(NEW.gerado_em, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_locked_snapshot
  BEFORE UPDATE ON public.proposta_versoes
  FOR EACH ROW
  EXECUTE FUNCTION protect_locked_snapshot();

-- 4) Trigger: bloquear transições de status inválidas
CREATE OR REPLACE FUNCTION public.validate_proposta_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Transições válidas
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: draft só pode ir para generated (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'generated' AND NEW.status NOT IN ('generated', 'sent') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: generated só pode ir para sent (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status = 'sent' AND NEW.status NOT IN ('sent', 'accepted', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: sent só pode ir para accepted/rejected/expired (tentou: %)', NEW.status
      USING ERRCODE = 'P0461';
  END IF;

  IF OLD.status IN ('accepted', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: status terminal (%) não pode ser alterado', OLD.status
      USING ERRCODE = 'P0461';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proposta_status
  BEFORE UPDATE ON public.proposta_versoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_proposta_status_transition();
