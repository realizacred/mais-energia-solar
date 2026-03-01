/**
 * Service for monitor subscription billing.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MonitorSubscription {
  id: string;
  tenant_id: string;
  client_id: string | null;
  plan_name: string;
  price_brl: number;
  billing_cycle: string;
  plant_ids: string[];
  max_plants: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitorBillingRecord {
  id: string;
  tenant_id: string;
  subscription_id: string;
  reference_month: number;
  reference_year: number;
  amount_brl: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export async function listSubscriptions(): Promise<MonitorSubscription[]> {
  const { data, error } = await supabase
    .from("monitor_subscriptions" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as MonitorSubscription[]) || [];
}

export async function createSubscription(sub: Partial<MonitorSubscription>): Promise<MonitorSubscription> {
  const { data, error } = await supabase
    .from("monitor_subscriptions" as any)
    .insert(sub as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as MonitorSubscription;
}

export async function updateSubscription(id: string, updates: Partial<MonitorSubscription>): Promise<void> {
  const { error } = await supabase
    .from("monitor_subscriptions" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function listBillingRecords(subscriptionId?: string): Promise<MonitorBillingRecord[]> {
  let q = supabase
    .from("monitor_billing_records" as any)
    .select("*")
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false });

  if (subscriptionId) q = q.eq("subscription_id", subscriptionId);

  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as MonitorBillingRecord[]) || [];
}

export async function createBillingRecord(record: Partial<MonitorBillingRecord>): Promise<void> {
  const { error } = await supabase
    .from("monitor_billing_records" as any)
    .insert(record as any);
  if (error) throw error;
}

export async function updateBillingRecord(id: string, updates: Partial<MonitorBillingRecord>): Promise<void> {
  const { error } = await supabase
    .from("monitor_billing_records" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}
