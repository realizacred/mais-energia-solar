
-- ============================================================
-- F) Coluna html em proposta_renders (persistir o HTML gerado)
-- ============================================================
ALTER TABLE public.proposta_renders
  ADD COLUMN IF NOT EXISTS html TEXT;

-- G) Unique index para idempotência do render (tenant + versao + tipo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_render_versao_tipo
  ON public.proposta_renders (tenant_id, versao_id, tipo);

-- B) RPC para gerar versao_numero de forma atômica (sem race condition)
CREATE OR REPLACE FUNCTION public.next_proposta_versao_numero(_proposta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  -- FOR UPDATE garante serialização: segunda chamada concorrente espera a primeira commitar
  SELECT COALESCE(MAX(versao_numero), 0) + 1
  INTO _next
  FROM proposta_versoes
  WHERE proposta_id = _proposta_id
  FOR UPDATE;

  -- Também atualiza versao_atual na propostas_nativas
  UPDATE propostas_nativas
  SET versao_atual = _next, updated_at = now()
  WHERE id = _proposta_id;

  RETURN _next;
END;
$$;
