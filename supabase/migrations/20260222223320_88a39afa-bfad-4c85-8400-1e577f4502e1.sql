
-- Fix: The sync_tenant_counters_values trigger was forcing next_value = last_value,
-- breaking the counter increment logic in next_tenant_number().
-- Replace with a sane version that only fills NULLs without clobbering valid differences.
CREATE OR REPLACE FUNCTION public.sync_tenant_counters_values()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  -- Only fill NULLs, never overwrite intentional differences
  IF NEW.last_value IS NULL AND NEW.next_value IS NOT NULL THEN
    NEW.last_value := GREATEST(NEW.next_value - 1, 0);
  ELSIF NEW.next_value IS NULL AND NEW.last_value IS NOT NULL THEN
    NEW.next_value := NEW.last_value + 1;
  END IF;

  -- Ensure next_value is always >= 1
  IF NEW.next_value IS NOT NULL AND NEW.next_value < 1 THEN
    NEW.next_value := 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Now fix the counter to correct value
UPDATE public.tenant_counters
SET next_value = 2, last_value = 1
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND entity = 'deal';
