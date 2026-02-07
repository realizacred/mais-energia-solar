-- Create table for Disjuntores (Circuit Breakers)
CREATE TABLE public.disjuntores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    amperagem INTEGER NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Transformadores (Transformers)
CREATE TABLE public.transformadores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    potencia_kva NUMERIC NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disjuntores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformadores ENABLE ROW LEVEL SECURITY;

-- RLS policies for disjuntores
CREATE POLICY "Usuários autenticados podem ver disjuntores" 
ON public.disjuntores 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin/Gerente podem gerenciar disjuntores" 
ON public.disjuntores 
FOR ALL 
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- RLS policies for transformadores
CREATE POLICY "Usuários autenticados podem ver transformadores" 
ON public.transformadores 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin/Gerente podem gerenciar transformadores" 
ON public.transformadores 
FOR ALL 
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Triggers for updated_at
CREATE TRIGGER update_disjuntores_updated_at
BEFORE UPDATE ON public.disjuntores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transformadores_updated_at
BEFORE UPDATE ON public.transformadores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();