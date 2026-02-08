-- Tabela para gerenciar os serviços exibidos no site
CREATE TABLE public.site_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  imagem_url TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_servicos ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura pública, escrita só admins
CREATE POLICY "Serviços visíveis publicamente"
  ON public.site_servicos FOR SELECT
  USING (true);

CREATE POLICY "Admins podem inserir serviços"
  ON public.site_servicos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Admins podem atualizar serviços"
  ON public.site_servicos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Admins podem deletar serviços"
  ON public.site_servicos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gerente')
    )
  );

-- Seed com os serviços atuais do site
INSERT INTO public.site_servicos (titulo, descricao, ordem) VALUES
  ('Projeto', 'Elaboramos um projeto único e customizado para atender as suas necessidades, utilizando softwares de cálculo avançados.', 1),
  ('Homologação', 'Cuidamos de todo o processo de legalização junto à distribuidora de energia, sem burocracia para você.', 2),
  ('Instalação', 'Instalamos o seu sistema usando os melhores equipamentos do mercado, com garantia e segurança total.', 3),
  ('Manutenção', 'Oferecemos manutenção preventiva para garantir que seu sistema funcione com máxima eficiência sempre.', 4);

-- Trigger de updated_at
CREATE TRIGGER update_site_servicos_updated_at
  BEFORE UPDATE ON public.site_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
