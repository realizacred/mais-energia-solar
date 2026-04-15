-- Desativar funil SDR / Prospecção (redundante, nenhum projeto usa)
UPDATE projeto_funis SET ativo = false WHERE id = '6078ee9d-7059-4dbe-aeee-39c0e84f1e09';

-- Deletar etapas do SDR (nenhum projeto vinculado)
DELETE FROM projeto_etapas WHERE funil_id = '6078ee9d-7059-4dbe-aeee-39c0e84f1e09';