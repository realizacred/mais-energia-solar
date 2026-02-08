
-- Seed gamification_config com valores padrão se a tabela estiver vazia
INSERT INTO public.gamification_config (
  meta_orcamentos_mensal,
  meta_conversoes_mensal,
  meta_valor_mensal,
  comissao_base_percent,
  comissao_bonus_meta_percent,
  achievement_points,
  tenant_id
)
SELECT
  30,
  10,
  150000,
  2.0,
  0.5,
  '{"high_volume": 150, "perfect_month": 400, "top_performer": 300, "fast_responder": 50, "consistency_king": 1000, "first_conversion": 100, "monthly_champion": 500, "conversion_streak": 200}'::jsonb,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.gamification_config);
