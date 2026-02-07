-- Fix RLS policies for anonymous lead/orcamento submission
-- Drop existing INSERT policies and recreate with correct roles

-- LEADS table
DROP POLICY IF EXISTS "Anyone can submit leads via form" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;

-- Create single INSERT policy that allows both anonymous and authenticated users
CREATE POLICY "Public can submit leads via form" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- ORCAMENTOS table  
DROP POLICY IF EXISTS "Anyone can submit orcamentos via form" ON public.orcamentos;

-- Create INSERT policy that allows both anonymous and authenticated users
CREATE POLICY "Public can submit orcamentos via form" 
ON public.orcamentos 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);