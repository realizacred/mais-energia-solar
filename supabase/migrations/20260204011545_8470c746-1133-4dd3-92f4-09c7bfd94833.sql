-- Create table for Concessionárias de Energia
CREATE TABLE public.concessionarias (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    sigla TEXT,
    estado TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.concessionarias ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuários autenticados podem ver concessionárias" 
ON public.concessionarias 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin/Gerente podem gerenciar concessionárias" 
ON public.concessionarias 
FOR ALL 
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Public can view active concessionárias (for forms)
CREATE POLICY "Público pode ver concessionárias ativas" 
ON public.concessionarias 
FOR SELECT 
USING (ativo = true);

-- Trigger for updated_at
CREATE TRIGGER update_concessionarias_updated_at
BEFORE UPDATE ON public.concessionarias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();