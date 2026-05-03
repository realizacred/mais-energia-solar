ALTER TABLE public.clientes ALTER COLUMN telefone DROP NOT NULL;

UPDATE public.clientes
SET telefone = NULL
WHERE telefone = '' AND is_sm_migrado = true;

COMMENT ON COLUMN public.clientes.identidade_url IS 'LEGADO — usar identidade_urls (array)';
COMMENT ON COLUMN public.clientes.potencia_kwp IS 'LEGADO — dado solar pertence a projetos, não a clientes';
COMMENT ON COLUMN public.clientes.valor_projeto IS 'LEGADO — dado solar pertence a projetos';
COMMENT ON COLUMN public.clientes.data_instalacao IS 'LEGADO — dado solar pertence a projetos';
COMMENT ON COLUMN public.clientes.numero_placas IS 'LEGADO — dado solar pertence a projetos';
COMMENT ON COLUMN public.clientes.modelo_inversor IS 'LEGADO — dado solar pertence a projetos';