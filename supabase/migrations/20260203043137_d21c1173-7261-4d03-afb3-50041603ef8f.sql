-- Create table for financing options (banks and rates)
CREATE TABLE public.financiamento_bancos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  taxa_mensal NUMERIC(5,2) NOT NULL,
  max_parcelas INTEGER NOT NULL DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for API configuration (optional auto-fetch of rates)
CREATE TABLE public.financiamento_api_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'API de Taxas',
  url TEXT,
  api_key TEXT,
  ativo BOOLEAN NOT NULL DEFAULT false,
  ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financiamento_bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financiamento_api_config ENABLE ROW LEVEL SECURITY;

-- Public can view active banks (for the calculator)
CREATE POLICY "Anyone can view active banks" 
ON public.financiamento_bancos 
FOR SELECT 
USING (ativo = true);

-- Authenticated users can manage banks
CREATE POLICY "Authenticated users can manage banks" 
ON public.financiamento_bancos 
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can view/manage API config
CREATE POLICY "Authenticated users can view API config" 
ON public.financiamento_api_config 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage API config" 
ON public.financiamento_api_config 
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add triggers for updated_at
CREATE TRIGGER update_financiamento_bancos_updated_at
BEFORE UPDATE ON public.financiamento_bancos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financiamento_api_config_updated_at
BEFORE UPDATE ON public.financiamento_api_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default banks
INSERT INTO public.financiamento_bancos (nome, taxa_mensal, max_parcelas, ordem) VALUES
  ('Santander Solar', 1.29, 60, 1),
  ('BV Financeira', 1.49, 72, 2),
  ('Banco do Brasil', 1.19, 48, 3),
  ('Caixa Econômica', 1.09, 60, 4);

-- Insert default API config (disabled)
INSERT INTO public.financiamento_api_config (nome, ativo) VALUES
  ('Configuração de API', false);