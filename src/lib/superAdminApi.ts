import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://bguhckqkpnziykpbwbeu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";

export async function callSuperAdminAction(body: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/super-admin-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
