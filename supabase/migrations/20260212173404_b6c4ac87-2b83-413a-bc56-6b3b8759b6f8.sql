
-- 1) DROP the leaked public policy that allows cross-tenant reads
DROP POLICY IF EXISTS "Service role can read all push subscriptions" ON public.push_subscriptions;

-- 2) DROP duplicate DELETE policies
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

-- 3) DROP duplicate INSERT policies  
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
