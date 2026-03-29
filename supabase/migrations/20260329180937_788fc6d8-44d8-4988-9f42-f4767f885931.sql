
-- 1. Add duration tracking column to proposta_aceite_tokens
ALTER TABLE proposta_aceite_tokens 
ADD COLUMN IF NOT EXISTS duracao_total_segundos integer NOT NULL DEFAULT 0;

-- 2. Create heartbeat RPC for duration tracking
CREATE OR REPLACE FUNCTION public.registrar_heartbeat_proposta(
  p_token uuid,
  p_segundos integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token_row proposta_aceite_tokens%ROWTYPE;
BEGIN
  -- Only update tracked tokens
  SELECT * INTO v_token_row FROM proposta_aceite_tokens
  WHERE token = p_token 
    AND expires_at > now()
    AND invalidado_em IS NULL
    AND tipo = 'tracked';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_not_tracked');
  END IF;

  -- Cap single heartbeat at 120s to prevent abuse
  IF p_segundos > 120 THEN
    p_segundos := 120;
  END IF;
  IF p_segundos < 1 THEN
    p_segundos := 1;
  END IF;

  UPDATE proposta_aceite_tokens SET
    duracao_total_segundos = COALESCE(duracao_total_segundos, 0) + p_segundos,
    last_viewed_at = now()
  WHERE id = v_token_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'duracao_total', COALESCE(v_token_row.duracao_total_segundos, 0) + p_segundos
  );
END;
$function$;

-- Grant execute to anon (public page calls this)
GRANT EXECUTE ON FUNCTION registrar_heartbeat_proposta(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION registrar_heartbeat_proposta(uuid, integer) TO authenticated;

-- 3. Index for proposal_events lookup by type + recency (for notifications)
CREATE INDEX IF NOT EXISTS idx_proposal_events_tipo_created 
ON proposal_events(tenant_id, tipo, created_at DESC);
