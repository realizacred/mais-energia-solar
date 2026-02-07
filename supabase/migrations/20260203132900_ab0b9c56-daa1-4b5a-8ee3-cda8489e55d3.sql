-- Adicionar política para permitir inserção pública de checklists
-- Quem tiver o link pode enviar o formulário sem precisar estar logado

CREATE POLICY "Anyone can submit checklists via public link"
ON public.checklists_instalacao
FOR INSERT
WITH CHECK (true);

-- Também permitir leitura pública dos checklists (para que a pessoa veja a confirmação)
CREATE POLICY "Anyone can view their submitted checklist"
ON public.checklists_instalacao
FOR SELECT
USING (true);