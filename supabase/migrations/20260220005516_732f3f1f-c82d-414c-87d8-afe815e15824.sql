-- Fix infinite recursion in internal_chat_members RLS policies
-- The SELECT policy references internal_chat_members itself, causing infinite recursion

-- Drop all existing policies on the 3 tables
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Authenticated users can add members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Members can update their own read status" ON public.internal_chat_members;

DROP POLICY IF EXISTS "Members can view their chats" ON public.internal_chats;
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.internal_chats;

DROP POLICY IF EXISTS "Members can view messages in their chats" ON public.internal_chat_messages;
DROP POLICY IF EXISTS "Members can send messages to their chats" ON public.internal_chat_messages;

-- ===== internal_chat_members =====
-- Simple policy: user can see rows where they are a member (no self-reference)
CREATE POLICY "Members see own memberships"
  ON public.internal_chat_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can also see OTHER members of chats they belong to
-- Use a function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_chat_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT chat_id FROM internal_chat_members WHERE user_id = _user_id;
$$;

CREATE POLICY "Members see co-members"
  ON public.internal_chat_members FOR SELECT
  TO authenticated
  USING (chat_id IN (SELECT get_user_chat_ids(auth.uid())));

-- Insert: authenticated users in same tenant
CREATE POLICY "Auth users add members"
  ON public.internal_chat_members FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Update: own read status
CREATE POLICY "Members update own status"
  ON public.internal_chat_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));

-- ===== internal_chats =====
CREATE POLICY "Members view own chats"
  ON public.internal_chats FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND id IN (SELECT get_user_chat_ids(auth.uid()))
  );

CREATE POLICY "Auth users create chats"
  ON public.internal_chats FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Update: for updating updated_at
CREATE POLICY "Members update own chats"
  ON public.internal_chats FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND id IN (SELECT get_user_chat_ids(auth.uid()))
  );

-- ===== internal_chat_messages =====
CREATE POLICY "Members view chat messages"
  ON public.internal_chat_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

CREATE POLICY "Members send chat messages"
  ON public.internal_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );