-- Corrige categoria das etapas canônicas Ganho/Perdido (estavam como 'aberto')
UPDATE public.projeto_etapas
SET categoria = 'ganho'
WHERE LOWER(TRIM(nome)) IN ('ganho', 'ganhou', 'vendido', 'fechado ganho')
  AND categoria <> 'ganho';

UPDATE public.projeto_etapas
SET categoria = 'perdido'
WHERE LOWER(TRIM(nome)) IN ('perdido', 'perdeu', 'cancelado', 'fechado perdido')
  AND categoria <> 'perdido';