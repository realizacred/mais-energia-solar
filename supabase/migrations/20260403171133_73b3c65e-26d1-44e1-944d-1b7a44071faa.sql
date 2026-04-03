-- Concessionárias são dados de referência nacional (ANEEL).
-- Todos os tenants autenticados devem poder ler concessionárias ativas.

-- Drop the restrictive tenant-only policy
DROP POLICY IF EXISTS rls_concessionarias_select_tenant ON concessionarias;

-- Create a new policy that allows all authenticated users to read active concessionarias
CREATE POLICY rls_concessionarias_select_authenticated
  ON concessionarias
  FOR SELECT
  TO authenticated
  USING (ativo = true);