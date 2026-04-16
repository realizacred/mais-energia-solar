
-- Mover Eric Nasareth para funil Engenharia, etapa "Finalizado"
-- funil_id: 6d08900c-4a8a-46b8-9d20-e52685440ccd (Engenharia em projeto_funis)
-- etapa_id: 25c98fb8-55ce-4ed6-879f-8bf5154fb222 (Finalizado em projeto_etapas)
UPDATE projetos
SET funil_id = '6d08900c-4a8a-46b8-9d20-e52685440ccd',
    etapa_id = '25c98fb8-55ce-4ed6-879f-8bf5154fb222',
    updated_at = now()
WHERE id = '406f1a43-bdd8-4522-a7e5-47c45d370e2c';
