
-- Soft delete: add 'excluida' to valid statuses and add deleted_at column
ALTER TABLE propostas_nativas ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Fix FK: projetos.proposta_id → SET NULL on delete
ALTER TABLE projetos DROP CONSTRAINT IF EXISTS projetos_proposta_id_fkey;
ALTER TABLE projetos ADD CONSTRAINT projetos_proposta_id_fkey 
  FOREIGN KEY (proposta_id) REFERENCES propostas_nativas(id) ON DELETE SET NULL;

-- Fix FK: proposta_aceite_tokens → CASCADE on delete (tokens follow the proposal)
ALTER TABLE proposta_aceite_tokens DROP CONSTRAINT IF EXISTS proposta_aceite_tokens_proposta_id_fkey;
ALTER TABLE proposta_aceite_tokens ADD CONSTRAINT proposta_aceite_tokens_proposta_id_fkey
  FOREIGN KEY (proposta_id) REFERENCES propostas_nativas(id) ON DELETE CASCADE;

-- Fix FK: proposta_views → CASCADE on delete
ALTER TABLE proposta_views DROP CONSTRAINT IF EXISTS proposta_views_proposta_id_fkey;
ALTER TABLE proposta_views ADD CONSTRAINT proposta_views_proposta_id_fkey
  FOREIGN KEY (proposta_id) REFERENCES propostas_nativas(id) ON DELETE CASCADE;

-- Fix FK: os_instalacao.proposta_id → SET NULL on delete
ALTER TABLE os_instalacao DROP CONSTRAINT IF EXISTS os_instalacao_proposta_id_fkey;
ALTER TABLE os_instalacao ADD CONSTRAINT os_instalacao_proposta_id_fkey
  FOREIGN KEY (proposta_id) REFERENCES propostas_nativas(id) ON DELETE SET NULL;

-- Fix FK: os_instalacao.versao_id → SET NULL on delete  
ALTER TABLE os_instalacao DROP CONSTRAINT IF EXISTS os_instalacao_versao_id_fkey;
ALTER TABLE os_instalacao ADD CONSTRAINT os_instalacao_versao_id_fkey
  FOREIGN KEY (versao_id) REFERENCES proposta_versoes(id) ON DELETE SET NULL;

-- Fix FK: proposta_envios.versao_id → CASCADE on delete
ALTER TABLE proposta_envios DROP CONSTRAINT IF EXISTS proposta_envios_versao_id_fkey;
ALTER TABLE proposta_envios ADD CONSTRAINT proposta_envios_versao_id_fkey
  FOREIGN KEY (versao_id) REFERENCES proposta_versoes(id) ON DELETE CASCADE;
