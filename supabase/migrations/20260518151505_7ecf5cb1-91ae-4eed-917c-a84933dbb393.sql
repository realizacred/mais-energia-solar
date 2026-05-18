CREATE OR REPLACE FUNCTION public.check_proposal_dependencies(p_proposta_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_projeto_id uuid;
  v_deal_id uuid;
  v_has_pagamento boolean;
  v_has_obra boolean;
  v_has_cheque boolean;
  v_deps text[] := ARRAY[]::text[];
  v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();

  -- 1. Get proposal context
  SELECT projeto_id, deal_id 
  INTO v_projeto_id, v_deal_id
  FROM propostas_nativas
  WHERE id = p_proposta_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN RETURN v_deps; END IF;

  -- 2. Check for payments (Lancamentos Financeiros)
  -- Consideramos dependência se houver pagamentos confirmados/efetivados vinculados ao projeto/deal
  IF v_projeto_id IS NOT NULL OR v_deal_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM lancamentos_financeiros 
      WHERE (projeto_id = v_projeto_id OR projeto_id = v_deal_id)
        AND status = 'pago'
        AND tenant_id = v_tenant_id
    ) INTO v_has_pagamento;
    IF v_has_pagamento THEN v_deps := array_append(v_deps, 'Pagamentos Efetuados'); END IF;
  END IF;

  -- 3. Check for technical visits / documents (Operational)
  -- 4. Check for Obra
  IF v_projeto_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM obras 
      WHERE projeto_id = v_projeto_id
        AND tenant_id = v_tenant_id
    ) INTO v_has_obra;
    IF v_has_obra THEN v_deps := array_append(v_deps, 'Obra/Instalação Iniciada'); END IF;
  END IF;

  -- 5. Check cheques (linked checks)
  IF v_projeto_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM cheques 
      WHERE projeto_id = v_projeto_id
        AND status NOT IN ('devolvido', 'sustado', 'cancelado')
        AND tenant_id = v_tenant_id
    ) INTO v_has_cheque;
    IF v_has_cheque THEN v_deps := array_append(v_deps, 'Cheques Vinculados'); END IF;
  END IF;

  RETURN v_deps;
END;
$function$;