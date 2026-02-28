
-- Fix existing Eloiza migration: correct dates and title
-- Deal
UPDATE public.deals 
SET title = 'Eloiza Suprino de Souza e Souza',
    created_at = '2026-02-23T18:30:36+00',
    updated_at = '2026-02-24T13:22:00+00'
WHERE id = 'b8b8edeb-38bb-49d7-a162-bd21982d3cda';

-- Projeto
UPDATE public.projetos
SET created_at = '2026-02-23T18:30:36+00',
    updated_at = '2026-02-24T13:22:00+00'
WHERE id = 'e66352e2-edc3-4978-9028-29e69b3ef33e';

-- Proposta Nativa
UPDATE public.propostas_nativas
SET titulo = 'Eloiza Suprino de Souza e Souza',
    created_at = '2026-02-23T18:34:17+00',
    updated_at = '2026-02-24T13:22:00+00',
    aceita_at = '2026-02-24T13:22:00+00'
WHERE id = 'e2e6ae05-57ad-4a2c-ba99-8ba2d6ffa9ce';

-- Proposta Versão
UPDATE public.proposta_versoes
SET created_at = '2026-02-23T18:34:17+00',
    updated_at = '2026-02-24T13:22:00+00'
WHERE proposta_id = 'e2e6ae05-57ad-4a2c-ba99-8ba2d6ffa9ce' AND versao_numero = 1;
