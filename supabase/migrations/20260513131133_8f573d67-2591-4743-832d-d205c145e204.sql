CREATE OR REPLACE FUNCTION public.trg_set_proposta_num()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.proposta_num is null then
    new.proposta_num := public.next_tenant_number(new.tenant_id, 'proposta');
  end if;

  if new.codigo is null then
    -- Padding adaptativo: mínimo 4 dígitos, mas nunca trunca números maiores.
    -- lpad(str, length) trunca quando length < length(str); GREATEST evita isso.
    new.codigo := 'PROP-' || lpad(
      new.proposta_num::text,
      GREATEST(4, length(new.proposta_num::text)),
      '0'
    );
  end if;

  if new.titulo is null or new.titulo = '' then
    new.titulo := 'Proposta #' || new.proposta_num::text;
  end if;

  return new;
end;
$function$;