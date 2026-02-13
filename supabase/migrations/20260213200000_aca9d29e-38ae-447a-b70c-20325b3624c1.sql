
-- Advisory lock RPC para process-wa-followups
-- Retorna true se adquiriu o lock, false se já está ocupado
CREATE OR REPLACE FUNCTION public.try_followup_lock()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Lock ID fixo para followup worker (hash arbitrário)
  RETURN pg_try_advisory_lock(hashtext('process-wa-followups'));
END;
$$;

-- Função para liberar o lock explicitamente
CREATE OR REPLACE FUNCTION public.release_followup_lock()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext('process-wa-followups'));
END;
$$;
