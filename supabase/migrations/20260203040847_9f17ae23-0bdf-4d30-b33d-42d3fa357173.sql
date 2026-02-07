-- Create calculator configuration table
CREATE TABLE public.calculadora_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarifa_media_kwh DECIMAL(10,4) NOT NULL DEFAULT 0.85,
  custo_por_kwp DECIMAL(10,2) NOT NULL DEFAULT 4500,
  geracao_mensal_por_kwp INTEGER NOT NULL DEFAULT 120,
  kg_co2_por_kwh DECIMAL(10,4) NOT NULL DEFAULT 0.084,
  percentual_economia INTEGER NOT NULL DEFAULT 95,
  vida_util_sistema INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calculadora_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (for public calculator)
CREATE POLICY "Anyone can view calculator config"
ON public.calculadora_config
FOR SELECT
USING (true);

-- Only authenticated users can update
CREATE POLICY "Authenticated users can update calculator config"
ON public.calculadora_config
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_calculadora_config_updated_at
BEFORE UPDATE ON public.calculadora_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.calculadora_config (
  tarifa_media_kwh,
  custo_por_kwp,
  geracao_mensal_por_kwp,
  kg_co2_por_kwh,
  percentual_economia,
  vida_util_sistema
) VALUES (
  0.85,
  4500,
  120,
  0.084,
  95,
  25
);

-- Create pipeline status table for Kanban
CREATE TABLE public.lead_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for lead_status
ALTER TABLE public.lead_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lead statuses"
ON public.lead_status
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage lead statuses"
ON public.lead_status
FOR ALL
USING (true);

-- Insert default statuses
INSERT INTO public.lead_status (nome, ordem, cor) VALUES
  ('Novo Lead', 1, '#6366f1'),
  ('Contato', 2, '#8b5cf6'),
  ('Visita', 3, '#f59e0b'),
  ('Proposta', 4, '#3b82f6'),
  ('Negociação', 5, '#ec4899'),
  ('Fechado', 6, '#22c55e');

-- Add status column to leads table
ALTER TABLE public.leads 
ADD COLUMN status_id UUID REFERENCES public.lead_status(id);