-- Fix leads table: Remove public SELECT access, keep only INSERT for form submission
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can submit leads via form" ON public.leads;

-- Create proper policies for leads
CREATE POLICY "Authenticated users can view all leads" 
ON public.leads 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can submit leads via form" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Fix vendedores table: Remove any public access
DROP POLICY IF EXISTS "Authenticated users can view vendedores" ON public.vendedores;

-- Create proper SELECT policy for vendedores (authenticated only)
CREATE POLICY "Authenticated users can view vendedores" 
ON public.vendedores 
FOR SELECT 
USING (auth.role() = 'authenticated');