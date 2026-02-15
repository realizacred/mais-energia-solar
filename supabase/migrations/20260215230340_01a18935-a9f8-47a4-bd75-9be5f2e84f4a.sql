
-- Allow anon to execute for the admin SQL runner (function itself has guardrails)
GRANT EXECUTE ON FUNCTION reset_solar_imports_preprod(UUID, TEXT) TO anon;
