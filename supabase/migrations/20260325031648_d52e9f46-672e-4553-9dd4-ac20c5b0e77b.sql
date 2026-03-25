
CREATE OR REPLACE FUNCTION public.get_proposal_workspace(p_versao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao record;
  v_proposta record;
  v_cliente_nome text;
  v_render record;
  v_os record;
  v_result jsonb;
BEGIN
  SELECT id, proposta_id, versao_numero, status, grupo, potencia_kwp, valor_total,
         economia_mensal, geracao_mensal, payback_meses, valido_ate, observacoes,
         snapshot, final_snapshot, snapshot_locked, finalized_at, public_slug,
         created_at, updated_at, gerado_em
  INTO v_versao
  FROM proposta_versoes
  WHERE id = p_versao_id;

  IF v_versao IS NULL THEN
    RETURN jsonb_build_object('error', 'versao_not_found');
  END IF;

  IF v_versao.proposta_id IS NOT NULL THEN
    SELECT id, titulo, codigo, status, origem, lead_id, cliente_id, projeto_id, deal_id,
           updated_at, status_visualizacao, primeiro_acesso_em, ultimo_acesso_em, total_aberturas
    INTO v_proposta
    FROM propostas_nativas
    WHERE id = v_versao.proposta_id;

    IF v_proposta.cliente_id IS NOT NULL THEN
      SELECT nome INTO v_cliente_nome
      FROM clientes
      WHERE id = v_proposta.cliente_id;
    END IF;
  END IF;

  SELECT id, html, url INTO v_render
  FROM proposta_renders
  WHERE versao_id = p_versao_id AND tipo = 'html'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id, numero_os, status INTO v_os
  FROM os_instalacao
  WHERE versao_id = p_versao_id
  LIMIT 1;

  v_result := jsonb_build_object(
    'versao', to_jsonb(v_versao),
    'proposta', CASE WHEN v_proposta IS NOT NULL THEN to_jsonb(v_proposta) ELSE null END,
    'cliente_nome', v_cliente_nome,
    'html', v_render.html,
    'public_url', v_render.url,
    'existing_os', CASE WHEN v_os IS NOT NULL THEN jsonb_build_object('id', v_os.id, 'numero_os', v_os.numero_os, 'status', v_os.status) ELSE null END
  );

  RETURN v_result;
END;
$$;
