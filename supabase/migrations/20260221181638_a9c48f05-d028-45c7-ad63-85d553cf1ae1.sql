-- Corrigir PIS/COFINS da Energisa MG (valores estavam incorretos: 1.2/1.5 → padrão nacional 1.65/7.60)
UPDATE concessionarias 
SET pis_percentual = 1.65, cofins_percentual = 7.60 
WHERE id = '9bd55dee-cf7c-4713-8a14-345598d1c9cb';