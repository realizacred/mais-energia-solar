
-- ============================================================
-- ESTOQUE v2.1 — PART 2: Views + RLS + RPCs
-- ============================================================

-- ── 1) RECREATE VIEW estoque_saldos (with disponivel + ajuste_sinal) ──
CREATE OR REPLACE VIEW public.estoque_saldos AS
SELECT
  i.tenant_id, i.id AS item_id, i.nome, i.sku, i.categoria, i.unidade,
  i.custo_medio, i.estoque_minimo, i.ativo, i.codigo_barras,
  COALESCE((
    SELECT SUM(CASE
      WHEN m.tipo = 'entrada' THEN m.quantidade
      WHEN m.tipo = 'saida'   THEN -m.quantidade
      WHEN m.tipo = 'ajuste'  THEN m.ajuste_sinal * m.quantidade
      ELSE 0 END)
    FROM public.estoque_movimentos m WHERE m.item_id = i.id
  ), 0) AS estoque_atual,
  COALESCE((
    SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r
    WHERE r.item_id = i.id AND r.status = 'active'
  ), 0) AS reservado,
  COALESCE((
    SELECT SUM(CASE
      WHEN m.tipo = 'entrada' THEN m.quantidade
      WHEN m.tipo = 'saida'   THEN -m.quantidade
      WHEN m.tipo = 'ajuste'  THEN m.ajuste_sinal * m.quantidade
      ELSE 0 END)
    FROM public.estoque_movimentos m WHERE m.item_id = i.id
  ), 0)
  - COALESCE((
    SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r
    WHERE r.item_id = i.id AND r.status = 'active'
  ), 0) AS disponivel
FROM public.estoque_itens i;

-- ── 2) RECREATE VIEW estoque_saldos_local ──────────────────
CREATE OR REPLACE VIEW public.estoque_saldos_local AS
SELECT
  m.tenant_id, m.item_id, m.local_id,
  i.nome AS item_nome, i.sku, i.unidade, l.nome AS local_nome,
  COALESCE(SUM(CASE
    WHEN m.tipo = 'entrada' THEN m.quantidade
    WHEN m.tipo = 'saida'   THEN -m.quantidade
    WHEN m.tipo = 'ajuste'  THEN m.ajuste_sinal * m.quantidade
    ELSE 0 END), 0) AS saldo_local,
  COALESCE((
    SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r
    WHERE r.item_id = m.item_id AND r.local_id = m.local_id AND r.status = 'active'
  ), 0) AS reservado_local,
  COALESCE(SUM(CASE
    WHEN m.tipo = 'entrada' THEN m.quantidade
    WHEN m.tipo = 'saida'   THEN -m.quantidade
    WHEN m.tipo = 'ajuste'  THEN m.ajuste_sinal * m.quantidade
    ELSE 0 END), 0)
  - COALESCE((
    SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r
    WHERE r.item_id = m.item_id AND r.local_id = m.local_id AND r.status = 'active'
  ), 0) AS disponivel_local
FROM public.estoque_movimentos m
JOIN public.estoque_itens i ON i.id = m.item_id
LEFT JOIN public.estoque_locais l ON l.id = m.local_id
WHERE m.local_id IS NOT NULL
GROUP BY m.tenant_id, m.item_id, m.local_id, i.nome, i.sku, i.unidade, l.nome;

-- ── 3) RLS: projeto_materiais + standardize to current_tenant_id() ──
ALTER TABLE public.projeto_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select" ON public.projeto_materiais;
CREATE POLICY "tenant_select" ON public.projeto_materiais FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_insert" ON public.projeto_materiais;
CREATE POLICY "tenant_insert" ON public.projeto_materiais FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_update" ON public.projeto_materiais;
CREATE POLICY "tenant_update" ON public.projeto_materiais FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_delete" ON public.projeto_materiais;
CREATE POLICY "tenant_delete" ON public.projeto_materiais FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- estoque_itens
DROP POLICY IF EXISTS "tenant_select" ON public.estoque_itens;
CREATE POLICY "tenant_select" ON public.estoque_itens FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_insert" ON public.estoque_itens;
CREATE POLICY "tenant_insert" ON public.estoque_itens FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_update" ON public.estoque_itens;
CREATE POLICY "tenant_update" ON public.estoque_itens FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_delete" ON public.estoque_itens;
CREATE POLICY "tenant_delete" ON public.estoque_itens FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- estoque_locais
DROP POLICY IF EXISTS "tenant_select" ON public.estoque_locais;
CREATE POLICY "tenant_select" ON public.estoque_locais FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_insert" ON public.estoque_locais;
CREATE POLICY "tenant_insert" ON public.estoque_locais FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_update" ON public.estoque_locais;
CREATE POLICY "tenant_update" ON public.estoque_locais FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_delete" ON public.estoque_locais;
CREATE POLICY "tenant_delete" ON public.estoque_locais FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- estoque_movimentos
DROP POLICY IF EXISTS "tenant_select" ON public.estoque_movimentos;
CREATE POLICY "tenant_select" ON public.estoque_movimentos FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_insert" ON public.estoque_movimentos;
CREATE POLICY "tenant_insert" ON public.estoque_movimentos FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

-- estoque_reservas
DROP POLICY IF EXISTS "tenant_select" ON public.estoque_reservas;
CREATE POLICY "tenant_select" ON public.estoque_reservas FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_insert" ON public.estoque_reservas;
CREATE POLICY "tenant_insert" ON public.estoque_reservas FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenant_update" ON public.estoque_reservas;
CREATE POLICY "tenant_update" ON public.estoque_reservas FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());

-- ── 4) FIX RPCs with tenant validation ─────────────────────

-- 4a) estoque_cancelar_reservas_projeto
DROP FUNCTION IF EXISTS public.estoque_cancelar_reservas_projeto(uuid, uuid);
CREATE OR REPLACE FUNCTION public.estoque_cancelar_reservas_projeto(p_projeto_id uuid, p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mat RECORD; v_count integer := 0; v_tenant_id uuid;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'No tenant in context'; END IF;
  FOR v_mat IN
    SELECT pm.id, pm.reserva_id FROM public.projeto_materiais pm
    WHERE pm.projeto_id = p_projeto_id AND pm.tenant_id = v_tenant_id
      AND pm.status = 'reservado' AND pm.reserva_id IS NOT NULL
  LOOP
    UPDATE public.estoque_reservas SET status = 'cancelled', updated_at = now() WHERE id = v_mat.reserva_id AND tenant_id = v_tenant_id;
    UPDATE public.projeto_materiais SET status = 'cancelado' WHERE id = v_mat.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 4b) estoque_consumir_projeto
DROP FUNCTION IF EXISTS public.estoque_consumir_projeto(uuid, uuid);
CREATE OR REPLACE FUNCTION public.estoque_consumir_projeto(p_projeto_id uuid, p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mat RECORD; v_count integer := 0; v_tenant_id uuid;
BEGIN
  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'No tenant in context'; END IF;
  FOR v_mat IN
    SELECT pm.id, pm.reserva_id FROM public.projeto_materiais pm
    WHERE pm.projeto_id = p_projeto_id AND pm.tenant_id = v_tenant_id
      AND pm.status = 'reservado' AND pm.reserva_id IS NOT NULL
  LOOP
    PERFORM public.estoque_consumir_reserva(v_mat.reserva_id, p_user_id, 'Consumo automático - projeto finalizado');
    UPDATE public.projeto_materiais SET status = 'consumido' WHERE id = v_mat.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
