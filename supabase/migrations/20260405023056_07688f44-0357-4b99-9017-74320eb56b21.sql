ALTER TABLE proposta_versoes
ADD COLUMN IF NOT EXISTS usuario_editou_em timestamptz;