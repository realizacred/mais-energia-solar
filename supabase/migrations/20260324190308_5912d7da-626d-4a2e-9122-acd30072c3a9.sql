-- Phase 1: Add is_principal column to propostas_nativas
ALTER TABLE public.propostas_nativas
  ADD COLUMN IF NOT EXISTS is_principal boolean NOT NULL DEFAULT false;

-- Partial unique index: at most 1 principal per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposta_principal_per_deal
  ON public.propostas_nativas (deal_id)
  WHERE is_principal = true AND deal_id IS NOT NULL;

-- Backfill: for each deal_id, set the best proposta as principal
-- Priority: aceita > enviada > gerada > most recent
WITH ranked AS (
  SELECT id, deal_id,
    ROW_NUMBER() OVER (
      PARTITION BY deal_id
      ORDER BY
        CASE status
          WHEN 'aceita' THEN 1
          WHEN 'enviada' THEN 2
          WHEN 'gerada' THEN 3
          ELSE 4
        END,
        created_at DESC
    ) AS rn
  FROM public.propostas_nativas
  WHERE deal_id IS NOT NULL
)
UPDATE public.propostas_nativas pn
SET is_principal = true
FROM ranked r
WHERE pn.id = r.id AND r.rn = 1;