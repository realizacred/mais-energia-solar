-- Migrate legacy tipo_telhado values in leads
UPDATE public.leads SET tipo_telhado = 'Metálico' WHERE tipo_telhado = 'Zinco (Metal)';
UPDATE public.leads SET tipo_telhado = 'Cerâmico' WHERE tipo_telhado IN ('Colonial (Madeira)', 'Colonial (Metal)');
UPDATE public.leads SET tipo_telhado = 'Fibrocimento' WHERE tipo_telhado IN ('Fibro (Madeira)', 'Fibro (Metal)');
UPDATE public.leads SET tipo_telhado = 'Solo' WHERE tipo_telhado IN ('Solo com Zinco', 'Solo com Eucalipto');

-- Migrate legacy tipo_telhado values in orcamentos
UPDATE public.orcamentos SET tipo_telhado = 'Metálico' WHERE tipo_telhado = 'Zinco (Metal)';
UPDATE public.orcamentos SET tipo_telhado = 'Cerâmico' WHERE tipo_telhado IN ('Colonial (Madeira)', 'Colonial (Metal)');
UPDATE public.orcamentos SET tipo_telhado = 'Fibrocimento' WHERE tipo_telhado IN ('Fibro (Madeira)', 'Fibro (Metal)');
UPDATE public.orcamentos SET tipo_telhado = 'Solo' WHERE tipo_telhado IN ('Solo com Zinco', 'Solo com Eucalipto');