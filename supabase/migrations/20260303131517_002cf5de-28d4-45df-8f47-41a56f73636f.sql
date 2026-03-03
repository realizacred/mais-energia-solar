-- Replace literal \n with actual newlines in all quick replies
UPDATE wa_quick_replies 
SET conteudo = REPLACE(conteudo, E'\\n', E'\n')
WHERE conteudo LIKE '%' || E'\\\\' || 'n%';