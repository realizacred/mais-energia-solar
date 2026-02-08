
-- Inserir projetos de exemplo no portfólio
INSERT INTO public.obras (titulo, descricao, cidade, estado, potencia_kwp, economia_mensal, tipo_projeto, numero_modulos, modelo_inversor, destaque, ativo, ordem) VALUES
('Residência Família Silva', 'Sistema fotovoltaico residencial com painéis de alta eficiência, proporcionando economia significativa na conta de luz.', 'Cataguases', 'MG', 3.89, 380, 'residencial', 7, 'Growatt 3000S', true, true, 1),
('Residência em Argirita', 'Instalação completa em telhado cerâmico com orientação ideal para máxima geração solar.', 'Argirita', 'MG', 3.35, 320, 'residencial', 6, 'Growatt 3000S', false, true, 2),
('Projeto Residencial Cataguases', 'Sistema compacto de alta performance para residência urbana, com retorno do investimento em menos de 4 anos.', 'Cataguases', 'MG', 3.27, 310, 'residencial', 6, 'Deye SUN-3K-G', false, true, 3),
('Sistema 7.22 kWp - Cataguases', 'Projeto de maior porte para residência com alto consumo energético. Economia de até 95% na conta de luz.', 'Cataguases', 'MG', 7.22, 690, 'residencial', 13, 'Growatt 6000TL-X', true, true, 4),
('Comércio Centro - Leopoldina', 'Sistema comercial instalado em loja no centro da cidade, reduzindo drasticamente os custos operacionais.', 'Leopoldina', 'MG', 12.50, 1200, 'comercial', 22, 'Growatt 10000TL3-S', true, true, 5),
('Fazenda Solar - Miraí', 'Projeto rural de grande porte para propriedade agrícola, garantindo autossuficiência energética.', 'Miraí', 'MG', 18.70, 1800, 'rural', 34, 'Deye SUN-15K-G', true, true, 6);
