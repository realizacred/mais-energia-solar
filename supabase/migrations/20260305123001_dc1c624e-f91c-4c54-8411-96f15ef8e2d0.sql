
-- ============================================================
-- ESTOQUE v2.1 — PART 1: Schema fixes + projeto_materiais creation
-- ============================================================

-- ── 1) ADD ajuste_sinal TO estoque_movimentos ──────────────
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS ajuste_sinal smallint NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_ajuste_sinal' AND constraint_schema = 'public') THEN
    ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_ajuste_sinal CHECK (ajuste_sinal IN (-1, 1));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_tipo_movimento' AND constraint_schema = 'public') THEN
    ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_tipo_movimento CHECK (tipo IN ('entrada','saida','ajuste'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_quantidade_positiva' AND constraint_schema = 'public') THEN
    ALTER TABLE public.estoque_movimentos ADD CONSTRAINT chk_quantidade_positiva CHECK (quantidade > 0);
  END IF;
END $$;

-- ── 2) ADD updated_at TO estoque_locais ────────────────────
ALTER TABLE public.estoque_locais
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 3) CREATE projeto_materiais ────────────────────────────
CREATE TABLE IF NOT EXISTS public.projeto_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id),
  local_id uuid REFERENCES public.estoque_locais(id),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  reserva_id uuid REFERENCES public.estoque_reservas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','reservado','consumido','cancelado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4) TRIGGER updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.estoque_locais;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.estoque_locais
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.projeto_materiais;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projeto_materiais
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 5) INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tenant_item ON public.estoque_movimentos(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tenant_item_local ON public.estoque_movimentos(tenant_id, item_id, local_id);
CREATE INDEX IF NOT EXISTS idx_estoque_reservas_tenant_item ON public.estoque_reservas(tenant_id, item_id, status);
CREATE INDEX IF NOT EXISTS idx_projeto_materiais_projeto ON public.projeto_materiais(projeto_id, status);
