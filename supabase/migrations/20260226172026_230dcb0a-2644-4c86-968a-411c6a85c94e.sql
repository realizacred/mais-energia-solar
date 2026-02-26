
-- Auto-resolve SLA alerts in real-time when an outbound message is sent
CREATE OR REPLACE FUNCTION public.auto_resolve_sla_on_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on outbound, non-internal messages
  IF NEW.direction = 'out' AND NEW.is_internal_note = false THEN
    UPDATE wa_sla_alerts
    SET resolved = true,
        resolved_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND resolved = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger after insert on wa_messages
DROP TRIGGER IF EXISTS trg_auto_resolve_sla_on_response ON wa_messages;
CREATE TRIGGER trg_auto_resolve_sla_on_response
  AFTER INSERT ON wa_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_resolve_sla_on_response();
