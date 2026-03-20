-- Add max_ucs_monitored limit to all plans
INSERT INTO plan_limits (plan_id, limit_key, limit_value) VALUES
  ('dddd041c-b9d3-4849-965a-fd77e6764834', 'max_ucs_monitored', 0),   -- FREE
  ('96f16a67-11bb-4ae2-8c7d-b787e4d71bc4', 'max_ucs_monitored', 5),   -- STARTER
  ('7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc', 'max_ucs_monitored', 20),  -- PRO
  ('a7a348ea-90c9-420a-a5c5-eb75b14c0522', 'max_ucs_monitored', 100); -- ENTERPRISE
