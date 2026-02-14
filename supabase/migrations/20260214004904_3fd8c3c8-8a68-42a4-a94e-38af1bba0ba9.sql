-- HMV4: Trigger to release open conversations when a consultor is deactivated
-- This prevents conversations from being stuck in limbo (assigned to inactive user)

CREATE OR REPLACE FUNCTION public.release_conversations_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when ativo changes from true to false
  IF OLD.ativo = true AND NEW.ativo = false AND NEW.user_id IS NOT NULL THEN
    UPDATE wa_conversations
    SET assigned_to = NULL, updated_at = now()
    WHERE assigned_to = NEW.user_id
      AND status = 'open';
    
    RAISE LOG 'release_conversations_on_deactivation: released open conversations for user_id=% (consultor=%)', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consultor_deactivate_release
  AFTER UPDATE OF ativo ON consultores
  FOR EACH ROW
  WHEN (OLD.ativo = true AND NEW.ativo = false)
  EXECUTE FUNCTION release_conversations_on_deactivation();