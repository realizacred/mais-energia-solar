
-- Inserir principais concessionárias brasileiras com dados atualizados
-- Tarifas residenciais B1 (convencional) em R$/kWh, valores aproximados ANEEL 2025
-- Custos de disponibilidade: mono=30kWh, bi=50kWh, tri=100kWh × tarifa

INSERT INTO public.concessionarias (nome, sigla, estado, tarifa_energia, tarifa_fio_b, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, aliquota_icms, possui_isencao_scee, percentual_isencao, ativo) VALUES
-- São Paulo
('CPFL Paulista', 'CPFL', 'SP', 0.78, 0.32, 23.40, 39.00, 78.00, 18, true, 100, true),
('Enel São Paulo (Eletropaulo)', 'ENEL-SP', 'SP', 0.82, 0.35, 24.60, 41.00, 82.00, 18, true, 100, true),
('EDP São Paulo (Bandeirante)', 'EDP-SP', 'SP', 0.76, 0.31, 22.80, 38.00, 76.00, 18, true, 100, true),
('CPFL Piratininga', 'CPFL-PIR', 'SP', 0.79, 0.33, 23.70, 39.50, 79.00, 18, true, 100, true),
('Elektro', 'ELEKTRO', 'SP', 0.77, 0.32, 23.10, 38.50, 77.00, 18, true, 100, true),
('Neoenergia Elektro', 'NEO-ELK', 'SP', 0.77, 0.32, 23.10, 38.50, 77.00, 18, true, 100, true),

-- Rio de Janeiro
('Enel Rio (Light)', 'LIGHT', 'RJ', 0.95, 0.38, 28.50, 47.50, 95.00, 20, false, 0, true),
('Enel Distribuição Rio', 'ENEL-RJ', 'RJ', 0.88, 0.36, 26.40, 44.00, 88.00, 20, false, 0, true),

-- Minas Gerais
('CEMIG Distribuição', 'CEMIG', 'MG', 0.85, 0.35, 25.50, 42.50, 85.00, 18, true, 100, true),
('Energisa Minas Gerais', 'EMG', 'MG', 0.82, 0.34, 24.60, 41.00, 82.00, 18, true, 100, true),

-- Rio Grande do Sul
('CEEE Equatorial', 'CEEE', 'RS', 0.83, 0.34, 24.90, 41.50, 83.00, 20, true, 100, true),
('RGE Sul', 'RGE', 'RS', 0.80, 0.33, 24.00, 40.00, 80.00, 20, true, 100, true),

-- Paraná
('Copel Distribuição', 'COPEL', 'PR', 0.74, 0.30, 22.20, 37.00, 74.00, 19, true, 100, true),
('Energisa Paraná', 'EPR', 'PR', 0.76, 0.31, 22.80, 38.00, 76.00, 19, true, 100, true),

-- Santa Catarina
('Celesc Distribuição', 'CELESC', 'SC', 0.72, 0.29, 21.60, 36.00, 72.00, 17, true, 100, true),

-- Bahia
('Neoenergia Coelba', 'COELBA', 'BA', 0.81, 0.33, 24.30, 40.50, 81.00, 20.5, true, 100, true),

-- Pernambuco
('Neoenergia Celpe', 'CELPE', 'PE', 0.79, 0.32, 23.70, 39.50, 79.00, 18, true, 100, true),

-- Ceará
('Enel Ceará (Coelce)', 'ENEL-CE', 'CE', 0.76, 0.31, 22.80, 38.00, 76.00, 18, true, 100, true),

-- Goiás
('Equatorial Goiás (CELG)', 'CELG', 'GO', 0.82, 0.34, 24.60, 41.00, 82.00, 19, true, 100, true),
('Enel Goiás', 'ENEL-GO', 'GO', 0.80, 0.33, 24.00, 40.00, 80.00, 19, true, 100, true),

-- Distrito Federal
('Neoenergia Brasília (CEB)', 'CEB', 'DF', 0.76, 0.31, 22.80, 38.00, 76.00, 18, true, 100, true),

-- Mato Grosso do Sul
('Energisa MS', 'EMS', 'MS', 0.81, 0.33, 24.30, 40.50, 81.00, 17, true, 100, true),

-- Mato Grosso
('Energisa MT', 'EMT', 'MT', 0.83, 0.34, 24.90, 41.50, 83.00, 17, true, 100, true),

-- Pará
('Equatorial Pará (CELPA)', 'CELPA', 'PA', 0.89, 0.37, 26.70, 44.50, 89.00, 17, true, 100, true),

-- Maranhão
('Equatorial Maranhão (CEMAR)', 'CEMAR', 'MA', 0.80, 0.33, 24.00, 40.00, 80.00, 18, true, 100, true),

-- Piauí
('Equatorial Piauí (CEPISA)', 'CEPISA', 'PI', 0.82, 0.34, 24.60, 41.00, 82.00, 18, true, 100, true),

-- Rio Grande do Norte
('Neoenergia Cosern', 'COSERN', 'RN', 0.77, 0.32, 23.10, 38.50, 77.00, 18, true, 100, true),

-- Paraíba
('Energisa Paraíba', 'EPB', 'PB', 0.78, 0.32, 23.40, 39.00, 78.00, 18, true, 100, true),

-- Alagoas
('Equatorial Alagoas (CEAL)', 'CEAL', 'AL', 0.84, 0.35, 25.20, 42.00, 84.00, 18, true, 100, true),

-- Sergipe
('Energisa Sergipe', 'ESE', 'SE', 0.81, 0.33, 24.30, 40.50, 81.00, 18, true, 100, true),

-- Espírito Santo
('EDP Espírito Santo (Escelsa)', 'EDP-ES', 'ES', 0.78, 0.32, 23.40, 39.00, 78.00, 17, true, 100, true),

-- Amazonas
('Amazonas Energia', 'AME', 'AM', 0.88, 0.36, 26.40, 44.00, 88.00, 18, false, 0, true),

-- Tocantins
('Energisa Tocantins', 'ETO', 'TO', 0.84, 0.35, 25.20, 42.00, 84.00, 18, true, 100, true),

-- Rondônia
('Energisa Rondônia', 'ERO', 'RO', 0.87, 0.36, 26.10, 43.50, 87.00, 17.5, true, 100, true),

-- Acre
('Energisa Acre', 'EAC', 'AC', 0.86, 0.35, 25.80, 43.00, 86.00, 17, true, 100, true),

-- Amapá
('CEA Equatorial', 'CEA', 'AP', 0.82, 0.34, 24.60, 41.00, 82.00, 18, true, 100, true),

-- Roraima
('Roraima Energia', 'RRE', 'RR', 0.85, 0.35, 25.50, 42.50, 85.00, 17, false, 0, true);
