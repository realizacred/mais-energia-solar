-- Create table for Instagram API configuration
CREATE TABLE public.instagram_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token text,
    user_id text,
    username text,
    ativo boolean NOT NULL DEFAULT false,
    ultima_sincronizacao timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage Instagram config
CREATE POLICY "Admins podem gerenciar config Instagram" 
ON public.instagram_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create table for cached Instagram posts
CREATE TABLE public.instagram_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_id text UNIQUE NOT NULL,
    media_type text,
    media_url text NOT NULL,
    thumbnail_url text,
    permalink text,
    caption text,
    timestamp timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts (public section)
CREATE POLICY "Qualquer um pode ver posts" 
ON public.instagram_posts 
FOR SELECT 
USING (true);

-- Only admins can manage posts
CREATE POLICY "Admins podem gerenciar posts" 
ON public.instagram_posts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_instagram_config_updated_at
BEFORE UPDATE ON public.instagram_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();