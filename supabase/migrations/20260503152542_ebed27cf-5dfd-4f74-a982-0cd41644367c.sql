DO $test$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_marker text := 'TEST-FASE1-' || extract(epoch from now())::bigint::text;
  v_consultor uuid := 'c0ecc5e7-0efd-41d7-a25e-e3aff106ab67';
  v_cliente uuid; v_projeto uuid; v_proposta uuid; v_versao uuid;
  v_qtd_venda int; v_qtd_recebimento int; v_qtd_parcelas int; v_qtd_comissao int;
  v_recebimento_id uuid; v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.tenant_id', v_tenant::text, true);

  INSERT INTO public.clientes (tenant_id, nome, telefone, cliente_code)
  VALUES (v_tenant, v_marker, '11999999999', v_marker) RETURNING id INTO v_cliente;

  INSERT INTO public.projetos (tenant_id, codigo, cliente_id, consultor_id, status)
  VALUES (v_tenant, v_marker, v_cliente, v_consultor, 'aguardando_documentacao') RETURNING id INTO v_projeto;

  INSERT INTO public.propostas_nativas (tenant_id, projeto_id, cliente_id, consultor_id, titulo, codigo, status, is_principal)
  VALUES (v_tenant, v_projeto, v_cliente, v_consultor, v_marker, v_marker, 'gerada', true) RETURNING id INTO v_proposta;

  INSERT INTO public.proposta_versoes (tenant_id, proposta_id, versao_numero, valor_total, potencia_kwp, snapshot)
  VALUES (v_tenant, v_proposta, 1, 0, 0,
    '{"pagamentoOpcoes":[{"is_default":true,"label":"3x","tipo":"parcelado","parcelas":3,"valor_parcela":5000,"entrada":0}]}'::jsonb)
  RETURNING id INTO v_versao;

  UPDATE public.proposta_versoes SET valor_total = 15000, potencia_kwp = 5.5 WHERE id = v_versao;
  UPDATE public.propostas_nativas SET status = 'aceita' WHERE id = v_proposta;

  SELECT count(*) INTO v_qtd_venda FROM public.vendas_transacional WHERE proposta_id = v_proposta;
  SELECT count(*) INTO v_qtd_comissao FROM public.comissoes WHERE projeto_id = v_projeto;
  SELECT count(*) INTO v_qtd_recebimento FROM public.recebimentos WHERE proposta_id = v_proposta;
  SELECT id INTO v_recebimento_id FROM public.recebimentos WHERE proposta_id = v_proposta LIMIT 1;
  SELECT count(*) INTO v_qtd_parcelas FROM public.parcelas WHERE recebimento_id = v_recebimento_id;

  RAISE NOTICE '=== TESTE FASE 1 (marker=%) ===', v_marker;
  RAISE NOTICE 'venda=%, comissao=%, recebimento=%, parcelas=% (esperado: 1,1,1,3)',
    v_qtd_venda, v_qtd_comissao, v_qtd_recebimento, v_qtd_parcelas;

  v_result := public.process_proposta_aceita(v_proposta);
  RAISE NOTICE 'reentrada (idempotência) -> %', v_result;

  SELECT count(*) INTO v_qtd_venda FROM public.vendas_transacional WHERE proposta_id = v_proposta;
  SELECT count(*) INTO v_qtd_recebimento FROM public.recebimentos WHERE proposta_id = v_proposta;
  SELECT count(*) INTO v_qtd_comissao FROM public.comissoes WHERE projeto_id = v_projeto;
  RAISE NOTICE 'pos-reentrada: venda=%, comissao=%, recebimento=% (esperado: 1,1,1)',
    v_qtd_venda, v_qtd_comissao, v_qtd_recebimento;

  IF v_qtd_venda <> 1 OR v_qtd_recebimento <> 1 OR v_qtd_parcelas <> 3 OR v_qtd_comissao <> 1 THEN
    RAISE EXCEPTION 'TESTE FALHOU venda=% receb=% parc=% com=%', v_qtd_venda, v_qtd_recebimento, v_qtd_parcelas, v_qtd_comissao;
  END IF;

  -- Cleanup
  DELETE FROM public.parcelas WHERE recebimento_id = v_recebimento_id;
  DELETE FROM public.recebimentos WHERE proposta_id = v_proposta;
  DELETE FROM public.comissoes WHERE projeto_id = v_projeto;
  DELETE FROM public.obras WHERE projeto_id = v_projeto;
  DELETE FROM public.vendas_transacional WHERE proposta_id = v_proposta;
  DELETE FROM public.proposta_versoes WHERE proposta_id = v_proposta;
  DELETE FROM public.propostas_nativas WHERE id = v_proposta;
  DELETE FROM public.projetos WHERE id = v_projeto;
  DELETE FROM public.clientes WHERE id = v_cliente;

  RAISE NOTICE '=== CLEANUP OK ===';
END;
$test$;