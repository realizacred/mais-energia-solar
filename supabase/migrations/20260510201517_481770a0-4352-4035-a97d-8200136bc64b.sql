drop view if exists public.vw_orcamentos_comercial;

create view public.vw_orcamentos_comercial with (security_invoker = true) as
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
  ml.matched_cliente_id,
  (
    select pr.id 
    from public.projetos pr 
    where pr.cliente_id = ml.matched_cliente_id 
    order by pr.created_at desc 
    limit 1
  ) as matched_projeto_id,
  coalesce(p.count, 0) as proposal_count,
  coalesce(pr_count.count, 0) as project_count,
  ls.nome as lead_status_nome
from public.orcamentos o
join public.leads l on o.lead_id = l.id
left join matched_leads ml on ml.orcamento_id = o.id
left join lateral (
  select count(*) as count from public.propostas_nativas p where p.cliente_id = ml.matched_cliente_id
) p on true
left join lateral (
  select count(*) as count from public.projetos pr2 where pr2.cliente_id = ml.matched_cliente_id
) pr_count on true
left join public.lead_status ls on o.status_id = ls.id;
