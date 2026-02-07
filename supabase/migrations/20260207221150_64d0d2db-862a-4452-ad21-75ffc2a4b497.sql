
-- Allow anonymous/public inserts into orcamentos (for calculator and public forms)
CREATE POLICY "Anyone can insert orcamentos"
ON public.orcamentos
FOR INSERT
WITH CHECK (true);

-- Rate limit for orcamentos: max 10 per hour per lead_id
CREATE OR REPLACE FUNCTION check_orcamento_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM orcamentos
  WHERE lead_id = NEW.lead_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many orcamentos for this lead';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_orcamento_rate_limit
BEFORE INSERT ON orcamentos
FOR EACH ROW
EXECUTE FUNCTION check_orcamento_rate_limit();
