UPDATE public.projeto_funis 
SET ativo = true 
WHERE nome IN ('Engenharia', 'Equipamento', 'Compensação', 'Pagamento')
AND ativo = false;