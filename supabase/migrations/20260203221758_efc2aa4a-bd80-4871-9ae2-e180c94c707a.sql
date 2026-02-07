-- Add user_id column to vendedores to link with auth users
ALTER TABLE public.vendedores 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_vendedores_user_id ON public.vendedores(user_id);

-- Create a function to get vendedor name by user_id (for RLS policies)
CREATE OR REPLACE FUNCTION public.get_vendedor_nome(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome FROM public.vendedores WHERE user_id = _user_id LIMIT 1
$$;

-- Update RLS policy for leads so vendedores can see their own leads
CREATE POLICY "Vendedor pode ver seus próprios leads"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role) 
  AND vendedor = get_vendedor_nome(auth.uid())
);

-- Allow vendedores to update their own leads
CREATE POLICY "Vendedor pode atualizar seus próprios leads"
ON public.leads
FOR UPDATE
USING (
  has_role(auth.uid(), 'vendedor'::app_role) 
  AND vendedor = get_vendedor_nome(auth.uid())
);

-- Allow vendedores to update their own profile in vendedores table
CREATE POLICY "Vendedor pode ver seu próprio perfil"
ON public.vendedores
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Vendedor pode atualizar seu próprio perfil"
ON public.vendedores
FOR UPDATE
USING (user_id = auth.uid());