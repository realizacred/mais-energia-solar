-- =============================================
-- 1) Remove duplicate deal_num trigger (keep trg_set_deal_num)
-- =============================================
DROP TRIGGER IF EXISTS trg_deals_auto_num ON public.deals;

-- =============================================
-- 2) Remove duplicate get_or_create_cliente overload (with p_tenant_id)
--    Keep only the SECURITY INVOKER version without p_tenant_id
-- =============================================
DROP FUNCTION IF EXISTS public.get_or_create_cliente(text, text, text, text, text, text, text, text, text, text, text, text, uuid);

-- =============================================
-- 3) Remove prevent_deal_history_update trigger
--    (incorrectly blocks UPDATE using audit_logs function)
-- =============================================
DROP TRIGGER IF EXISTS prevent_deal_history_update ON public.deal_stage_history;

-- =============================================
-- 4) Also remove prevent_deal_history_delete if it exists
-- =============================================
DROP TRIGGER IF EXISTS prevent_deal_history_delete ON public.deal_stage_history;