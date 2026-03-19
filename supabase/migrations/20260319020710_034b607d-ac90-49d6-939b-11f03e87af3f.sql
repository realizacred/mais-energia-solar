
CREATE TABLE IF NOT EXISTS public.help_center_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria varchar(50) NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  titulo varchar(200) NOT NULL,
  descricao_curta text,
  conteudo text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0,
  icon varchar(50),
  video_url text,
  imagens text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  is_destaque boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_tutorials_categoria ON public.help_center_tutorials(categoria, ordem);

CREATE TABLE IF NOT EXISTS public.help_center_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tutorial_id uuid REFERENCES public.help_center_tutorials(id) ON DELETE CASCADE NOT NULL,
  concluido boolean DEFAULT false,
  ultimo_acesso timestamptz DEFAULT now(),
  UNIQUE(user_id, tutorial_id)
);

CREATE INDEX IF NOT EXISTS idx_help_progresso_user ON public.help_center_progresso(user_id);

ALTER TABLE public.help_center_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_center_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tutorials"
ON public.help_center_tutorials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own progress"
ON public.help_center_progresso FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
