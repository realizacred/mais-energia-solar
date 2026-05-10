CREATE OR REPLACE FUNCTION public.get_orcamentos_comercial_stats(
  p_tenant_id uuid,
  p_search text DEFAULT ''::text,
  p_vendedor_id uuid DEFAULT NULL::uuid,
  p_status_id uuid DEFAULT NULL::uuid,
  p_estado text DEFAULT 'todos'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  result json;
begin
  select json_build_object(
    'total', count(*),
    'sem_proposta', count(*) filter (where matched_projeto_id is null and lead_status_nome != 'Perdido'),
    'com_proposta', count(*) filter (where matched_projeto_id is not null),
    'sem_projeto',  count(*) filter (where matched_projeto_id is null and lead_status_nome != 'Perdido'),
    'convertidos',  count(*) filter (where matched_projeto_id is not null),
    'perdidos',     count(*) filter (where lead_status_nome = 'Perdido'),
    'novos_mes',    count(*) filter (where created_at >= date_trunc('month', now()))
  ) into result
  from public.vw_orcamentos_comercial v
  where v.tenant_id = p_tenant_id
    and (p_search = '' or v.lead_nome ilike '%' || p_search || '%' or v.orc_code ilike '%' || p_search || '%' or v.lead_code ilike '%' || p_search || '%')
    and (p_vendedor_id is null or v.consultor_id = p_vendedor_id)
    and (p_status_id is null or v.status_id = p_status_id)
    and (p_estado = 'todos' or v.estado = p_estado);

  return result;
end;
$function$;