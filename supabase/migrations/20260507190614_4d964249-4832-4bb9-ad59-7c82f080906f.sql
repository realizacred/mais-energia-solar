UPDATE public.sm_manual_review
SET resolved_at = now()
WHERE resolved_at IS NULL
  AND reason = 'phone_collision_diff_name';