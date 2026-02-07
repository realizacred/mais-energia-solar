-- Add column to track which simulation was accepted
ALTER TABLE public.clientes 
ADD COLUMN simulacao_aceita_id uuid REFERENCES public.simulacoes(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_clientes_simulacao_aceita ON public.clientes(simulacao_aceita_id);

-- Comment for documentation
COMMENT ON COLUMN public.clientes.simulacao_aceita_id IS 'Reference to the simulation/proposal that was accepted by the client';