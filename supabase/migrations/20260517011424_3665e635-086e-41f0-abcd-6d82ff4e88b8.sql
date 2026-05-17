-- Add columns to analise_credito table
ALTER TABLE public.analise_credito
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS cliente_email TEXT,
ADD COLUMN IF NOT EXISTS cliente_telefone TEXT,
ADD COLUMN IF NOT EXISTS cliente_data_nascimento DATE,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS kit_fotovoltaico NUMERIC,
ADD COLUMN IF NOT EXISTS mao_obra NUMERIC,
ADD COLUMN IF NOT EXISTS potencia_instalada NUMERIC,
ADD COLUMN IF NOT EXISTS media_conta_energia NUMERIC,
ADD COLUMN IF NOT EXISTS area_instalacao NUMERIC,
ADD COLUMN IF NOT EXISTS situacao_imovel TEXT,
ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
ADD COLUMN IF NOT EXISTS com_seguro BOOLEAN DEFAULT false;

-- Comment for developer reference
COMMENT ON COLUMN public.analise_credito.kit_fotovoltaico IS 'Value of the PV kit for EOS simulation (kitFotovoltaico)';
COMMENT ON COLUMN public.analise_credito.mao_obra IS 'Value of labor for EOS simulation (maoObra)';
COMMENT ON COLUMN public.analise_credito.potencia_instalada IS 'System power in kWp (potenciaInstaladaSugerida)';
COMMENT ON COLUMN public.analise_credito.media_conta_energia IS 'Average energy bill value (mediaContaEnergia)';
COMMENT ON COLUMN public.analise_credito.situacao_imovel IS 'Property status: QUITADO, FINANCIADO, ALUGADO';
