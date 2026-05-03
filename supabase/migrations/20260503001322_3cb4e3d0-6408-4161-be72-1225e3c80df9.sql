
-- =========================================================================
-- FASE 1: Tabela canônica VENDA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.vendas_transacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  proposta_id uuid NOT NULL REFERENCES public.propostas_nativas(id) ON DELETE RESTRICT,
  versao_id uuid NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE RESTRICT,
  cliente_id uuid,
  projeto_id uuid,
  deal_id uuid,
  valor_total numeric,
  potencia_kwp numeric,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','cancelada')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vendas_transacional_versao UNIQUE (versao_id)
);

CREATE INDEX IF NOT EXISTS idx_vendas_trans_tenant ON public.vendas_transacional(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_trans_proposta ON public.vendas_transacional(proposta_id);
CREATE INDEX IF NOT EXISTS idx_vendas_trans_projeto ON public.vendas_transacional(projeto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_trans_deal ON public.vendas_transacional(deal_id);

ALTER TABLE public.vendas_transacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_trans_select_tenant" ON public.vendas_transacional
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "vendas_trans_update_tenant" ON public.vendas_transacional
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER trg_vendas_trans_updated_at
  BEFORE UPDATE ON public.vendas_transacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FASE 4: Tabela OBRA (execução)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.obras_transacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  venda_id uuid NOT NULL REFERENCES public.vendas_transacional(id) ON DELETE CASCADE,
  projeto_id uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_obras_trans_venda UNIQUE (venda_id)
);

CREATE INDEX IF NOT EXISTS idx_obras_trans_tenant ON public.obras_transacional(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obras_trans_projeto ON public.obras_transacional(projeto_id);

ALTER TABLE public.obras_transacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obras_trans_select_tenant" ON public.obras_transacional
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "obras_trans_update_tenant" ON public.obras_transacional
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER trg_obras_trans_updated_at
  BEFORE UPDATE ON public.obras_transacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FASE 4.1: Função obra a partir de venda
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_obra_from_venda(p_venda_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda public.vendas_transacional%ROWTYPE;
  v_obra_id uuid;
BEGIN
  SELECT * INTO v_venda FROM public.vendas_transacional WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'venda % não encontrada', p_venda_id;
  END IF;

  -- Idempotência
  SELECT id INTO v_obra_id FROM public.obras_transacional WHERE venda_id = p_venda_id;
  IF v_obra_id IS NOT NULL THEN
    RETURN v_obra_id;
  END IF;

  INSERT INTO public.obras_transacional (tenant_id, venda_id, projeto_id, status)
  VALUES (v_venda.tenant_id, v_venda.id, v_venda.projeto_id, 'pendente')
  RETURNING id INTO v_obra_id;

  RETURN v_obra_id;
END;
$$;

-- =========================================================================
-- FASE 2: Função canônica VENDA a partir de proposta aceita
-- =========================================================================
CREATE OR REPLACE FUNCTION public.create_venda_from_proposta(p_versao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao public.proposta_versoes%ROWTYPE;
  v_proposta public.propostas_nativas%ROWTYPE;
  v_venda_id uuid;
  v_cliente_id uuid;
  v_projeto_id uuid;
  v_deal_id uuid;
BEGIN
  SELECT * INTO v_versao FROM public.proposta_versoes WHERE id = p_versao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'versao % não encontrada', p_versao_id;
  END IF;

  SELECT * INTO v_proposta FROM public.propostas_nativas WHERE id = v_versao.proposta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposta % não encontrada', v_versao.proposta_id;
  END IF;

  IF lower(coalesce(v_proposta.status::text, '')) NOT IN ('aceita','aceito','aceitado','aprovada','aprovado') THEN
    RAISE EXCEPTION 'proposta % não está aceita (status atual: %)', v_proposta.id, v_proposta.status;
  END IF;

  -- Idempotência: já existe venda para essa versão?
  SELECT id INTO v_venda_id FROM public.vendas_transacional WHERE versao_id = p_versao_id;
  IF v_venda_id IS NOT NULL THEN
    -- Garante obra também
    PERFORM public.create_obra_from_venda(v_venda_id);
    RETURN v_venda_id;
  END IF;

  -- Resolver entidades vinculadas a partir da proposta
  v_cliente_id := v_proposta.cliente_id;
  v_projeto_id := v_proposta.projeto_id;
  v_deal_id := v_proposta.deal_id;

  INSERT INTO public.vendas_transacional (
    tenant_id, proposta_id, versao_id, cliente_id, projeto_id, deal_id,
    valor_total, potencia_kwp, status
  ) VALUES (
    v_proposta.tenant_id,
    v_proposta.id,
    v_versao.id,
    v_cliente_id,
    v_projeto_id,
    v_deal_id,
    v_versao.valor_total,
    v_versao.potencia_kwp,
    'aberta'
  )
  RETURNING id INTO v_venda_id;

  -- Cria obra automaticamente
  PERFORM public.create_obra_from_venda(v_venda_id);

  RETURN v_venda_id;
END;
$$;

-- =========================================================================
-- FASE 3: Trigger em propostas_nativas (status -> aceita)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_proposta_aceita_cria_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao_id uuid;
BEGIN
  -- Só age na transição para aceita
  IF lower(coalesce(NEW.status::text,'')) NOT IN ('aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(coalesce(OLD.status::text,'')) = lower(coalesce(NEW.status::text,'')) THEN
    RETURN NEW;
  END IF;

  -- Pega versão principal (ou a mais recente)
  SELECT id INTO v_versao_id
  FROM public.proposta_versoes
  WHERE proposta_id = NEW.id
  ORDER BY versao_numero DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_versao_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.create_venda_from_proposta(v_versao_id);
  EXCEPTION WHEN OTHERS THEN
    -- Não bloqueia o update da proposta caso ocorra erro na criação da venda
    RAISE WARNING 'create_venda_from_proposta falhou para proposta %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposta_aceita_cria_venda ON public.propostas_nativas;
CREATE TRIGGER trg_proposta_aceita_cria_venda
  AFTER INSERT OR UPDATE OF status ON public.propostas_nativas
  FOR EACH ROW EXECUTE FUNCTION public.trg_proposta_aceita_cria_venda();
