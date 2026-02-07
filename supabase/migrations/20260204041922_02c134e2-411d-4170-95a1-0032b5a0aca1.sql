-- Create orcamentos table for proposals/quotes
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orc_code TEXT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  
  -- Address data (can vary per proposal)
  cep TEXT NULL,
  estado TEXT NOT NULL,
  cidade TEXT NOT NULL,
  bairro TEXT NULL,
  rua TEXT NULL,
  numero TEXT NULL,
  complemento TEXT NULL,
  
  -- Technical data
  area TEXT NOT NULL,
  tipo_telhado TEXT NOT NULL,
  rede_atendimento TEXT NOT NULL,
  media_consumo INTEGER NOT NULL,
  consumo_previsto INTEGER NOT NULL,
  
  -- Files and notes
  arquivos_urls TEXT[] DEFAULT '{}'::TEXT[],
  observacoes TEXT NULL,
  
  -- Tracking
  vendedor TEXT NULL,
  status_id UUID NULL REFERENCES public.lead_status(id),
  visto BOOLEAN NOT NULL DEFAULT false,
  visto_admin BOOLEAN NOT NULL DEFAULT false,
  ultimo_contato TIMESTAMP WITH TIME ZONE NULL,
  proxima_acao TEXT NULL,
  data_proxima_acao DATE NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for orcamento codes
CREATE SEQUENCE IF NOT EXISTS public.orcamento_code_seq START WITH 1;

-- Create trigger to generate ORC-XXX codes
CREATE OR REPLACE FUNCTION public.generate_orcamento_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.orc_code := 'ORC-' || LPAD(nextval('public.orcamento_code_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_orcamento_code_trigger
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_orcamento_code();

-- Create trigger for updated_at
CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orcamentos (same pattern as leads)
CREATE POLICY "Anyone can submit orcamentos via form"
  ON public.orcamentos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all orcamentos"
  ON public.orcamentos
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update orcamentos"
  ON public.orcamentos
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete orcamentos"
  ON public.orcamentos
  FOR DELETE
  USING (true);

CREATE POLICY "Vendedor pode ver seus próprios orcamentos"
  ON public.orcamentos
  FOR SELECT
  USING (has_role(auth.uid(), 'vendedor'::app_role) AND vendedor = get_vendedor_nome(auth.uid()));

CREATE POLICY "Vendedor pode atualizar seus próprios orcamentos"
  ON public.orcamentos
  FOR UPDATE
  USING (has_role(auth.uid(), 'vendedor'::app_role) AND vendedor = get_vendedor_nome(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_orcamentos_lead_id ON public.orcamentos(lead_id);
CREATE INDEX idx_orcamentos_vendedor ON public.orcamentos(vendedor);
CREATE INDEX idx_orcamentos_telefone_lookup ON public.leads(telefone);

-- Add unique constraint on leads telefone for deduplication
-- First, let's add a normalized_telefone column for consistent lookups
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS telefone_normalized TEXT GENERATED ALWAYS AS (
  regexp_replace(telefone, '[^0-9]', '', 'g')
) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_telefone_normalized ON public.leads(telefone_normalized);