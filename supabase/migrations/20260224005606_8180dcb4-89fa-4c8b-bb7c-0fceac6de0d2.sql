-- =============================================
-- Fix: projeto_etiqueta_rel references deals (not projetos)
-- The CRM operates on deals, not projetos. The FK and RLS must reflect this.
-- =============================================

-- 1. Drop existing constraints and policies
ALTER TABLE projeto_etiqueta_rel DROP CONSTRAINT IF EXISTS projeto_etiqueta_rel_projeto_id_fkey;

DROP POLICY IF EXISTS projeto_etiqueta_rel_select ON projeto_etiqueta_rel;
DROP POLICY IF EXISTS projeto_etiqueta_rel_insert ON projeto_etiqueta_rel;
DROP POLICY IF EXISTS projeto_etiqueta_rel_delete ON projeto_etiqueta_rel;

-- 2. Add new FK to deals
ALTER TABLE projeto_etiqueta_rel
  ADD CONSTRAINT projeto_etiqueta_rel_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES deals(id) ON DELETE CASCADE;

-- 3. Recreate RLS policies referencing deals instead of projetos
CREATE POLICY "projeto_etiqueta_rel_select" ON projeto_etiqueta_rel
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = projeto_etiqueta_rel.projeto_id
        AND d.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "projeto_etiqueta_rel_insert" ON projeto_etiqueta_rel
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = projeto_etiqueta_rel.projeto_id
        AND d.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "projeto_etiqueta_rel_delete" ON projeto_etiqueta_rel
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = projeto_etiqueta_rel.projeto_id
        AND d.tenant_id = get_user_tenant_id()
    )
  );