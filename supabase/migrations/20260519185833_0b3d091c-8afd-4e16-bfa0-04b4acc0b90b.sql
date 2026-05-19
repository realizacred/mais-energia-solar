ALTER TABLE public.deals 
ADD COLUMN won_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN won_by UUID REFERENCES auth.users(id);

-- Comentários para documentação
COMMENT ON COLUMN public.deals.won_at IS 'Data/hora exata do ganho comercial confirmado.';
COMMENT ON COLUMN public.deals.won_by IS 'Usuário responsável pela marcação do ganho.';
