-- Create vendedores table
CREATE TABLE public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  codigo TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users only
CREATE POLICY "Authenticated users can view vendedores"
ON public.vendedores
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create vendedores"
ON public.vendedores
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendedores"
ON public.vendedores
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete vendedores"
ON public.vendedores
FOR DELETE
USING (true);

-- Function to generate unique vendor code
CREATE OR REPLACE FUNCTION public.generate_vendedor_codigo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo := lower(regexp_replace(NEW.nome, '[^a-zA-Z0-9]', '', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate codigo
CREATE TRIGGER generate_vendedor_codigo_trigger
BEFORE INSERT ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.generate_vendedor_codigo();

-- Trigger for updated_at
CREATE TRIGGER update_vendedores_updated_at
BEFORE UPDATE ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for codigo lookups
CREATE INDEX idx_vendedores_codigo ON public.vendedores(codigo);
CREATE INDEX idx_vendedores_ativo ON public.vendedores(ativo);