CREATE OR REPLACE FUNCTION public.resolve_portal_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res jsonb;
  v_row record;
BEGIN
  -- Search in deals table (where portal_token was added)
  SELECT 
    d.id as deal_id,
    d.projeto_id,
    d.tenant_id,
    d.portal_ativo,
    p.nome as projeto_nome,
    p.projeto_num,
    p.codigo as projeto_codigo,
    p.etapa_id,
    p.potencia_kwp,
    p.valor_total,
    p.status as projeto_status,
    p.cep, p.rua, p.numero, p.bairro, p.cidade, p.estado,
    c.id as cliente_id,
    c.nome as cliente_nome,
    cons.id as consultor_id,
    cons.nome as consultor_nome,
    cons.telefone as consultor_telefone,
    et.nome as etapa_nome,
    et.cor as etapa_cor
  INTO v_row
  FROM public.deals d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.clientes c ON c.id = d.customer_id
  LEFT JOIN public.consultores cons ON cons.id = d.owner_id
  LEFT JOIN public.projeto_etapas et ON et.id = p.etapa_id
  WHERE d.portal_token = p_token
  LIMIT 1;

  IF v_row.deal_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Token inválido');
  END IF;

  IF NOT v_row.portal_ativo THEN
    RETURN jsonb_build_object('error', 'Portal desativado');
  END IF;

  -- Get brand settings
  SELECT jsonb_build_object(
    'logo_url', (settings->'brand'->>'logo_url'),
    'color_primary', (settings->'brand'->>'color_primary'),
    'company_name', t.nome
  ) INTO v_res
  FROM public.tenants t
  LEFT JOIN public.profiles prof ON prof.tenant_id = t.id AND prof.role = 'admin'
  WHERE t.id = v_row.tenant_id
  ORDER BY prof.created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_row.projeto_id,
    'nome', v_row.projeto_nome,
    'projeto_num', v_row.projeto_num,
    'codigo', v_row.projeto_codigo,
    'etapa_id', v_row.etapa_id,
    'etapa_nome', v_row.etapa_nome,
    'etapa_cor', v_row.etapa_cor,
    'status', v_row.projeto_status,
    'potencia_kwp', v_row.potencia_kwp,
    'valor_total', v_row.valor_total,
    'cliente_id', v_row.cliente_id,
    'cliente_nome', v_row.cliente_nome,
    'consultor_id', v_row.consultor_id,
    'consultor_nome', v_row.consultor_nome,
    'consultor_telefone', v_row.consultor_telefone,
    'tenant_id', v_row.tenant_id,
    'brand', v_res,
    'portal_ativo', v_row.portal_ativo,
    'address', jsonb_build_object(
      'cep', v_row.cep,
      'rua', v_row.rua,
      'numero', v_row.numero,
      'bairro', v_row.bairro,
      'cidade', v_row.cidade,
      'estado', v_row.estado
    )
  );
END;
$$;

-- Grant access to anonymous users
GRANT EXECUTE ON FUNCTION public.resolve_portal_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_portal_token(uuid) TO authenticated;