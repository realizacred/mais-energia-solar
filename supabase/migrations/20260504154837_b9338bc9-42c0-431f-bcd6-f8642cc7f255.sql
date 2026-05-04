-- RB-47: Remover UPDATE anon direto em proposta_aceite_tokens.
-- Aceite/recusa pública passa exclusivamente pela edge function proposal-public-action
-- (service_role bypass RLS). Frontend público NÃO pode mais alterar tokens diretamente.
DROP POLICY IF EXISTS "Anyone can update tokens for acceptance" ON public.proposta_aceite_tokens;