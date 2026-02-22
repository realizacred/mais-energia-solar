
-- ============================================================
-- ETAPA 2+3: Hardening deals + Limpeza FKs duplicadas
-- Pré-condições verificadas:
--   deals: 0 rows total, 0 customer_id NULL, 0 deal_num NULL
--   FKs duplicadas confirmadas via pg_constraint snapshot
-- ============================================================

-- ── ETAPA 2A: deals.customer_id SET NOT NULL ──
ALTER TABLE public.deals ALTER COLUMN customer_id SET NOT NULL;

-- ── ETAPA 2B: deals.deal_num SET NOT NULL ──
ALTER TABLE public.deals ALTER COLUMN deal_num SET NOT NULL;

-- ── ETAPA 2C: FK owner_id → consultores(id) ON DELETE RESTRICT ──
-- (não existe atualmente — verificado no snapshot)
ALTER TABLE public.deals
  ADD CONSTRAINT deals_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.consultores(id)
  ON DELETE RESTRICT;

-- ── ETAPA 2D: Recriar FK customer_id com ON DELETE RESTRICT ──
-- Atual: deals_customer_id_fkey → FK(customer_id) REFERENCES clientes(id) [NO ACTION]
ALTER TABLE public.deals DROP CONSTRAINT deals_customer_id_fkey;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.clientes(id)
  ON DELETE RESTRICT;

-- ── ETAPA 3A: Dropar FK duplicada em projetos ──
-- MANTER: fk_projetos_cliente → RESTRICT
-- DROPAR: projetos_cliente_id_fkey → NO ACTION (redundante, menos restritiva)
ALTER TABLE public.projetos DROP CONSTRAINT projetos_cliente_id_fkey;

-- ── ETAPA 3B: Dropar FKs duplicadas em propostas_nativas ──
-- MANTER: fk_propostas_projeto → CASCADE
-- DROPAR: propostas_nativas_projeto_id_fkey → CASCADE+UPDATE (redundante)
ALTER TABLE public.propostas_nativas DROP CONSTRAINT propostas_nativas_projeto_id_fkey;

-- MANTER: fk_propostas_cliente → RESTRICT  
-- DROPAR: propostas_nativas_cliente_id_fkey → NO ACTION (redundante, menos restritiva)
ALTER TABLE public.propostas_nativas DROP CONSTRAINT propostas_nativas_cliente_id_fkey;

-- DROPAR: FK composta redundante (tenant_id, projeto_id) → projetos(tenant_id, id)
-- Já coberta por fk_propostas_projeto + trigger trg_validate_proposta_tenant
ALTER TABLE public.propostas_nativas DROP CONSTRAINT propostas_nativas_tenant_projeto_fkey;
