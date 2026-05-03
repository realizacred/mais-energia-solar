
CREATE TABLE IF NOT EXISTS public.comissoes_transacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  venda_id uuid NOT NULL REFERENCES public.vendas_transacional(id) ON DELETE CASCADE,
  consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  valor_base numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','paga','cancelada')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comissoes_transacional_venda_unique UNIQUE (venda_id)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_trans_tenant ON public.comissoes_transacional(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_trans_consultor ON public.comissoes_transacional(consultor_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_trans_status ON public.comissoes_transacional(status);

ALTER TABLE public.comissoes_transacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comissoes_trans_select_tenant"
  ON public.comissoes_transacional FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "comissoes_trans_admin_all"
  ON public.comissoes_transacional FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_comissoes_trans_updated_at
  BEFORE UPDATE ON public.comissoes_transacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_audit_comissoes_trans
  AFTER INSERT OR UPDATE OR DELETE ON public.comissoes_transacional
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE OR REPLACE FUNCTION public.create_comissao_from_venda(p_venda_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda public.vendas_transacional%ROWTYPE;
  v_owner_id uuid;
  v_consultor_id uuid;
  v_percentual numeric := 5;
  v_valor_comissao numeric;
  v_existing uuid;
  v_comissao_id uuid;
BEGIN
  SELECT id INTO v_existing FROM public.comissoes_transacional WHERE venda_id = p_venda_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_venda FROM public.vendas_transacional WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  IF v_venda.deal_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner_id FROM public.deals WHERE id = v_venda.deal_id;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    SELECT id, COALESCE(percentual_comissao, 5) INTO v_consultor_id, v_percentual
    FROM public.consultores
    WHERE user_id = v_owner_id AND tenant_id = v_venda.tenant_id
    LIMIT 1;
  END IF;

  IF v_percentual IS NULL THEN
    v_percentual := 5;
  END IF;

  v_valor_comissao := COALESCE(v_venda.valor_total, 0) * v_percentual / 100.0;

  INSERT INTO public.comissoes_transacional (
    tenant_id, venda_id, consultor_id, valor_base, percentual, valor_comissao, status
  ) VALUES (
    v_venda.tenant_id, p_venda_id, v_consultor_id,
    COALESCE(v_venda.valor_total, 0), v_percentual, v_valor_comissao, 'pendente'
  )
  ON CONFLICT (venda_id) DO NOTHING
  RETURNING id INTO v_comissao_id;

  IF v_comissao_id IS NULL THEN
    SELECT id INTO v_comissao_id FROM public.comissoes_transacional WHERE venda_id = p_venda_id;
  END IF;

  RETURN v_comissao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_venda_cria_comissao_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.create_comissao_from_venda(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_comissao_from_venda falhou para venda %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venda_trans_cria_comissao ON public.vendas_transacional;
CREATE TRIGGER trg_venda_trans_cria_comissao
  AFTER INSERT ON public.vendas_transacional
  FOR EACH ROW EXECUTE FUNCTION public.trg_venda_cria_comissao_fn();
