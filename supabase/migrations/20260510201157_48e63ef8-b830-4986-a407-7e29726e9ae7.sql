-- View unificada para análise comercial de leads/orçamentos
create or replace view public.vw_orcamentos_comercial with (security_invoker = true) as
with matched_leads as (
  select 
    o.id as orcamento_id,
    c.id as matched_cliente_id
  from public.orcamentos o
  join public.leads l on o.lead_id = l.id
  left join lateral (
    select c.id 
    from public.clientes c 
    where c.tenant_id = o.tenant_id
      and (
        (l.telefone_normalized is not null and c.telefone_normalized is not null and l.telefone_normalized = c.telefone_normalized)
        OR
        (l.email is not null and c.email is not null and lower(l.email) = lower(c.email))
      )
    limit 1
  ) c on true
)
select 
  o.*,
  l.nome as lead_nome,
  l.telefone as lead_telefone,
  l.telefone_normalized as lead_telefone_normalized,
  l.email as lead_email,
  l.lead_code,
  coalesce(p.count, 0) as proposal_count,
  coalesce(pr.count, 0) as project_count,
  ls.nome as lead_status_nome
from public.orcamentos o
join public.leads l on o.lead_id = l.id
left join matched_leads ml on ml.orcamento_id = o.id
left join lateral (
  select count(*) as count from public.propostas_nativas p where p.cliente_id = ml.matched_cliente_id
) p on true
left join lateral (
  select count(*) as count from public.projetos pr where pr.cliente_id = ml.matched_cliente_id
) pr on true
left join public.lead_status ls on o.status_id = ls.id;

-- Função para obter estatísticas de conversão respeitando filtros
create or replace function public.get_orcamentos_comercial_stats(
  p_tenant_id uuid,
  p_search text default '',
  p_vendedor_id uuid default null,
  p_status_id uuid default null,
  p_estado text default 'todos'
)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'total', count(*),
    'sem_proposta', count(*) filter (where proposal_count = 0 and lead_status_nome != 'Perdido'),
    'com_proposta', count(*) filter (where proposal_count > 0),
    'sem_projeto', count(*) filter (where proposal_count > 0 and project_count = 0 and lead_status_nome != 'Perdido'),
    'convertidos', count(*) filter (where project_count > 0),
    'perdidos', count(*) filter (where lead_status_nome = 'Perdido')
  ) into result
  from public.vw_orcamentos_comercial v
  where v.tenant_id = p_tenant_id
    and (p_search = '' or v.lead_nome ilike '%' || p_search || '%' or v.orc_code ilike '%' || p_search || '%' or v.lead_code ilike '%' || p_search || '%')
    and (p_vendedor_id is null or v.consultor_id = p_vendedor_id)
    and (p_status_id is null or v.status_id = p_status_id)
    and (p_estado = 'todos' or v.estado = p_estado);
    
  return result;
end;
$$ language plpgsql security definer;
