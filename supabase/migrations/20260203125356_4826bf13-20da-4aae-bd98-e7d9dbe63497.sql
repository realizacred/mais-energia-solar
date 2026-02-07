-- Create table for installation checklists
CREATE TABLE public.checklists_instalacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Info da instalação
  data_instalacao DATE NOT NULL,
  endereco TEXT NOT NULL,
  bairro TEXT,
  lead_code TEXT,
  
  -- Área do cliente
  placas_local_aprovado BOOLEAN DEFAULT false,
  inversor_local_aprovado BOOLEAN DEFAULT false,
  avaliacao_atendimento TEXT CHECK (avaliacao_atendimento IN ('otimo', 'bom', 'razoavel', 'ruim', 'muito_ruim')),
  nome_cliente TEXT NOT NULL,
  assinatura_cliente_url TEXT,
  
  -- Área do instalador
  adesivo_inversor BOOLEAN DEFAULT false,
  plaquinha_relogio BOOLEAN DEFAULT false,
  configuracao_wifi BOOLEAN DEFAULT false,
  foto_servico BOOLEAN DEFAULT false,
  observacoes TEXT,
  
  -- Fotos e assinatura do instalador
  fotos_urls TEXT[] DEFAULT '{}',
  assinatura_instalador_url TEXT,
  instalador_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Sync status for offline support
  synced BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.checklists_instalacao ENABLE ROW LEVEL SECURITY;

-- Policies: Only authenticated users (instaladores) can CRUD their own checklists
CREATE POLICY "Instaladores podem ver seus próprios checklists"
  ON public.checklists_instalacao
  FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Instaladores podem criar checklists"
  ON public.checklists_instalacao
  FOR INSERT
  TO authenticated
  WITH CHECK (instalador_id = auth.uid());

CREATE POLICY "Instaladores podem atualizar seus próprios checklists"
  ON public.checklists_instalacao
  FOR UPDATE
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Instaladores podem deletar seus próprios checklists"
  ON public.checklists_instalacao
  FOR DELETE
  TO authenticated
  USING (instalador_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_checklists_updated_at
  BEFORE UPDATE ON public.checklists_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for checklist assets (photos and signatures)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-assets', 'checklist-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for checklist assets
CREATE POLICY "Authenticated users can upload checklist assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'checklist-assets');

CREATE POLICY "Authenticated users can view checklist assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'checklist-assets');

CREATE POLICY "Users can update their own checklist assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'checklist-assets');

CREATE POLICY "Users can delete their own checklist assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'checklist-assets');