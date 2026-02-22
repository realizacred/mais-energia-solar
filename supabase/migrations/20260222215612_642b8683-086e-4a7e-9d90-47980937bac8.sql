
-- ============================================================
-- MIGRAÇÃO: Integridade relacional + códigos obrigatórios
-- ============================================================

-- ============================================================
-- 1) BACKFILL PREVENTIVO (dados já estão limpos, mas safety-net)
-- ============================================================

-- 1a) clientes sem cliente_code
UPDATE public.clientes
SET cliente_code = 'CLI-' || LPAD(nextval('public.cliente_code_seq')::TEXT, 4, '0')
WHERE cliente_code IS NULL OR btrim(cliente_code) = '';

-- 1b) projetos sem codigo
UPDATE public.projetos
SET projeto_num = public.next_tenant_number(tenant_id, 'projeto')
WHERE projeto_num IS NULL;

UPDATE public.projetos
SET codigo = 'PROJ-' || LPAD(projeto_num::TEXT, 4, '0')
WHERE codigo IS NULL OR btrim(codigo) = '';

-- 1c) propostas_nativas sem codigo
UPDATE public.propostas_nativas
SET proposta_num = public.next_tenant_number(tenant_id, 'proposta')
WHERE proposta_num IS NULL;

UPDATE public.propostas_nativas
SET codigo = 'PROP-' || LPAD(proposta_num::TEXT, 4, '0')
WHERE codigo IS NULL OR btrim(codigo) = '';

-- ============================================================
-- 2) NOT NULL CONSTRAINTS
-- ============================================================

ALTER TABLE public.clientes ALTER COLUMN cliente_code SET NOT NULL;

ALTER TABLE public.projetos ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN projeto_num SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN cliente_id SET NOT NULL;

ALTER TABLE public.propostas_nativas ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE public.propostas_nativas ALTER COLUMN proposta_num SET NOT NULL;
ALTER TABLE public.propostas_nativas ALTER COLUMN projeto_id SET NOT NULL;

-- ============================================================
-- 3) RECRIAR UNIQUE INDEXES (por tenant, sem WHERE parcial)
-- ============================================================

-- clientes: dropar o índice global e criar por tenant
DROP INDEX IF EXISTS public.idx_clientes_cliente_code;
CREATE UNIQUE INDEX uq_clientes_tenant_cliente_code 
  ON public.clientes (tenant_id, cliente_code);

-- projetos: dropar o índice global e criar por tenant
DROP INDEX IF EXISTS public.idx_projetos_codigo;
CREATE UNIQUE INDEX uq_projetos_tenant_codigo 
  ON public.projetos (tenant_id, codigo);

-- propostas_nativas: criar unique por tenant+codigo
CREATE UNIQUE INDEX uq_propostas_tenant_codigo 
  ON public.propostas_nativas (tenant_id, codigo);

-- ============================================================
-- 4) FOREIGN KEYS (idempotent — só cria se não existir)
-- ============================================================

-- 4a) projetos.cliente_id -> clientes.id ON DELETE RESTRICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_projetos_cliente' AND table_name = 'projetos'
  ) THEN
    ALTER TABLE public.projetos 
      ADD CONSTRAINT fk_projetos_cliente 
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4b) propostas_nativas.projeto_id -> projetos.id ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_propostas_projeto' AND table_name = 'propostas_nativas'
  ) THEN
    ALTER TABLE public.propostas_nativas 
      ADD CONSTRAINT fk_propostas_projeto 
      FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4c) propostas_nativas.cliente_id -> clientes.id ON DELETE RESTRICT (se coluna existe)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='propostas_nativas' AND column_name='cliente_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_propostas_cliente' AND table_name = 'propostas_nativas'
  ) THEN
    -- cliente_id pode ser NULL em propostas (herda do projeto), então sem NOT NULL
    ALTER TABLE public.propostas_nativas 
      ADD CONSTRAINT fk_propostas_cliente 
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================================
-- 5) TRIGGERS DE VALIDAÇÃO CROSS-TENANT
-- ============================================================

-- 5a) projetos: cliente deve ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.validate_projeto_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado', NEW.cliente_id;
  END IF;
  IF v_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cliente % pertence a outro tenant', NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_projeto_tenant ON public.projetos;
CREATE TRIGGER trg_validate_projeto_tenant
  BEFORE INSERT OR UPDATE OF cliente_id ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_projeto_tenant();

-- 5b) propostas: projeto deve ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.validate_proposta_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.projetos WHERE id = NEW.projeto_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Projeto % não encontrado', NEW.projeto_id;
  END IF;
  IF v_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Projeto % pertence a outro tenant', NEW.projeto_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_proposta_tenant ON public.propostas_nativas;
CREATE TRIGGER trg_validate_proposta_tenant
  BEFORE INSERT OR UPDATE OF projeto_id ON public.propostas_nativas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_proposta_tenant();

-- ============================================================
-- 6) MELHORAR GERAÇÃO DE cliente_code POR TENANT
-- ============================================================
-- O trigger atual usa uma sequência global. Vamos melhorar para usar next_tenant_number.

CREATE OR REPLACE FUNCTION public.generate_cliente_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cliente_code IS NULL OR btrim(NEW.cliente_code) = '' THEN
    NEW.cliente_code := 'CLI-' || LPAD(public.next_tenant_number(NEW.tenant_id, 'cliente')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
