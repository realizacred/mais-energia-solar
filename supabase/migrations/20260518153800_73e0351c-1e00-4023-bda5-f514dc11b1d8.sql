-- Update constraint to allow both PT and EN temporarily or just new EN
ALTER TABLE propostas_nativas DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE propostas_nativas ADD CONSTRAINT chk_status CHECK (
  status = ANY (ARRAY[
    'rascunho', 'gerada', 'enviada', 'aceita', 'recusada', 'expirada', 'cancelada', 'arquivada', 'excluida', 'vista', 'perdida', 'ganha',
    'draft', 'generated', 'sent', 'accepted', 'rejected', 'expired'
  ])
);

-- Now update the data
UPDATE propostas_nativas SET status = 'draft' WHERE status = 'rascunho';
UPDATE propostas_nativas SET status = 'generated' WHERE status = 'gerada';
UPDATE propostas_nativas SET status = 'sent' WHERE status = 'enviada';
UPDATE propostas_nativas SET status = 'accepted' WHERE status = 'aceita';
UPDATE propostas_nativas SET status = 'rejected' WHERE status = 'recusada';
UPDATE propostas_nativas SET status = 'rejected' WHERE status = 'cancelada';
UPDATE propostas_nativas SET status = 'sent' WHERE status = 'vista';

-- Finally, restrict to only EN labels (matching the enum + excluida/arquivada)
ALTER TABLE propostas_nativas DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE propostas_nativas ADD CONSTRAINT chk_status CHECK (
  status = ANY (ARRAY['draft', 'generated', 'sent', 'accepted', 'rejected', 'expired', 'excluida', 'arquivada'])
);