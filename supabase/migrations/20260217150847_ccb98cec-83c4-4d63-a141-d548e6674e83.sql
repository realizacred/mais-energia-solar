-- Grant anon access to validate_consultor_code (needed for public /v/:slug links)
GRANT EXECUTE ON FUNCTION public.validate_consultor_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_consultor_code(text) TO authenticated;