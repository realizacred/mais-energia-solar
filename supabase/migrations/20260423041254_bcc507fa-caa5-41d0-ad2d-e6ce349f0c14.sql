UPDATE solarmarket_promotion_jobs
SET status = 'cancelled',
    updated_at = NOW()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND status IN ('running', 'pending');