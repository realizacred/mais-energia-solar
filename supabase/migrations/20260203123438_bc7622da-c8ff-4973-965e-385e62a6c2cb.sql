-- Add policy to allow public read of vendedor codes for form validation
-- Only expose minimal fields needed for validation (codigo, nome, ativo)
CREATE POLICY "Public can view active vendedor codes" 
ON public.vendedores 
FOR SELECT 
USING (ativo = true);