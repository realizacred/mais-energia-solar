
-- Fix Fabio Barral project: link to funil "Vendedor" at etapa "Novo"
UPDATE projetos
SET funil_id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0',  -- Vendedor
    etapa_id = '2484fdfa-dcda-4dcb-86ac-ce68ac26973e',  -- Novo
    updated_at = now()
WHERE id = '667de033-4632-4cc6-951a-cc147b768bcc'
  AND funil_id IS NULL;
