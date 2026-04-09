-- Migrate {var} → {{var}} in wa_automation_templates
UPDATE public.whatsapp_automation_templates
SET mensagem = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(mensagem, '\{nome\}', '{{nome}}', 'g'),
        '\{cidade\}', '{{cidade}}', 'g'),
      '\{estado\}', '{{estado}}', 'g'),
    '\{consumo\}', '{{consumo}}', 'g'),
  '\{vendedor\}', '{{vendedor}}', 'g')
WHERE mensagem ~ '\{(nome|cidade|estado|consumo|vendedor)\}'
  AND mensagem NOT LIKE '%{{nome}}%';

-- Migrate {var} → {{var}} in wa_quick_replies
UPDATE public.wa_quick_replies
SET conteudo = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(conteudo, '\{nome\}', '{{nome}}', 'g'),
            '\{cidade\}', '{{cidade}}', 'g'),
          '\{estado\}', '{{estado}}', 'g'),
        '\{consumo\}', '{{consumo}}', 'g'),
      '\{vendedor\}', '{{vendedor}}', 'g'),
    '\{consultor\}', '{{consultor}}', 'g'),
  '\{telefone\}', '{{telefone}}', 'g')
WHERE conteudo ~ '\{(nome|cidade|estado|consumo|vendedor|consultor|telefone)\}';

-- Migrate {var} → {{var}} in auto_reply_message
UPDATE public.whatsapp_automation_config
SET auto_reply_message = regexp_replace(
  regexp_replace(auto_reply_message, '\{nome\}', '{{nome}}', 'g'),
  '\{telefone\}', '{{telefone}}', 'g')
WHERE auto_reply_message IS NOT NULL
  AND auto_reply_message ~ '\{(nome|telefone)\}';

-- Migrate {var} → {{var}} in wa_followup_rules
UPDATE public.wa_followup_rules
SET mensagem_template = regexp_replace(
  regexp_replace(mensagem_template, '\{nome\}', '{{nome}}', 'g'),
  '\{vendedor\}', '{{vendedor}}', 'g')
WHERE mensagem_template IS NOT NULL
  AND mensagem_template ~ '\{(nome|vendedor)\}';