
-- Drop the legacy overload that conflicts with the current one used by the frontend.
-- The frontend calls registrar_view_proposta(p_token, p_user_agent, p_referrer, p_device_type, p_screen_width).
-- The legacy signature (uuid, text, text, text) was causing PostgREST to fail to resolve the overload,
-- silently dropping all view tracking events.
DROP FUNCTION IF EXISTS public.registrar_view_proposta(uuid, text, text, text);
