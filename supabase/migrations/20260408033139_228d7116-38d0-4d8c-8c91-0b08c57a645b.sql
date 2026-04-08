-- Add data_conversao column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_conversao timestamptz;

-- Backfill: for leads already converted, use updated_at as approximation
UPDATE leads 
SET data_conversao = updated_at 
WHERE status_id = '2e20c255-68e1-4d82-abaa-c0df84cc0991' 
  AND data_conversao IS NULL;

-- Trigger function: auto-set data_conversao when status changes to Convertido
CREATE OR REPLACE FUNCTION set_data_conversao_on_convert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convertido_id uuid;
BEGIN
  SELECT id INTO v_convertido_id 
  FROM lead_status 
  WHERE nome = 'Convertido' 
  LIMIT 1;

  IF v_convertido_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Set data_conversao when status changes TO Convertido
  IF NEW.status_id = v_convertido_id 
     AND (OLD.status_id IS DISTINCT FROM v_convertido_id) 
     AND NEW.data_conversao IS NULL THEN
    NEW.data_conversao := NOW();
  END IF;

  -- Clear data_conversao if status changes FROM Convertido to something else
  IF OLD.status_id = v_convertido_id 
     AND NEW.status_id IS DISTINCT FROM v_convertido_id THEN
    NEW.data_conversao := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_data_conversao ON leads;
CREATE TRIGGER trg_set_data_conversao
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_data_conversao_on_convert();