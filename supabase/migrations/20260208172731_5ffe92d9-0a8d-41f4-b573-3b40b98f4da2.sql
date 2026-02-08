
-- Create obras table for portfolio management
CREATE TABLE public.obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'MG',
  potencia_kwp NUMERIC,
  economia_mensal NUMERIC,
  tipo_projeto TEXT NOT NULL DEFAULT 'residencial',
  data_conclusao DATE,
  imagens_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  video_url TEXT,
  destaque BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  numero_modulos INTEGER,
  modelo_inversor TEXT,
  cliente_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.obras IS 'Portfólio de obras realizadas exibidas no site público';

-- Enable RLS
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- Public can read active obras
CREATE POLICY "Public read active obras"
  ON public.obras
  FOR SELECT
  USING (ativo = true);

-- Admins manage all obras
CREATE POLICY "Admins manage obras"
  ON public.obras
  FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail
CREATE TRIGGER audit_obras
  AFTER INSERT OR UPDATE OR DELETE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger_fn();

-- Create storage bucket for obra images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('obras-portfolio', 'obras-portfolio', true);

-- Storage policies for obras-portfolio bucket
CREATE POLICY "Public read obras-portfolio"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'obras-portfolio');

CREATE POLICY "Admins upload obras-portfolio"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'obras-portfolio' AND is_admin(auth.uid()));

CREATE POLICY "Admins update obras-portfolio"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'obras-portfolio' AND is_admin(auth.uid()));

CREATE POLICY "Admins delete obras-portfolio"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'obras-portfolio' AND is_admin(auth.uid()));
