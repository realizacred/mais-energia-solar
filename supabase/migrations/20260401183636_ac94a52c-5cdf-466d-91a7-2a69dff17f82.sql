
ALTER TABLE fechamentos_caixa
  ADD COLUMN IF NOT EXISTS total_receitas_avulsas numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_despesas numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_receitas numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_periodo numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown_categorias jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS breakdown_despesas jsonb DEFAULT '{}';

-- observacoes and fechado_por may already exist; add IF NOT EXISTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fechamentos_caixa' AND column_name='observacoes') THEN
    ALTER TABLE fechamentos_caixa ADD COLUMN observacoes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fechamentos_caixa' AND column_name='fechado_por') THEN
    ALTER TABLE fechamentos_caixa ADD COLUMN fechado_por uuid REFERENCES auth.users(id);
  END IF;
END $$;
