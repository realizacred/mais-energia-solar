/**
 * InvoiceService — Canonical service for UC invoices and billing email settings.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UnitInvoice {
  id: string;
  unit_id: string;
  reference_month: number;
  reference_year: number;
  due_date: string | null;
  total_amount: number | null;
  energy_consumed_kwh: number | null;
  energy_injected_kwh: number | null;
  compensated_kwh: number | null;
  previous_balance_kwh: number | null;
  current_balance_kwh: number | null;
  pdf_file_url: string | null;
  source: string | null;
  status: string;
  created_at: string;
}

export interface BillingEmailSettings {
  id: string;
  unit_id: string;
  billing_capture_email: string | null;
  forward_to_email: string | null;
  pdf_password: string | null;
  email_billing_enabled: boolean;
  setup_status: string;
  notes: string | null;
}

const INVOICE_COLS = `id, unit_id, reference_month, reference_year, due_date, total_amount, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, previous_balance_kwh, current_balance_kwh, pdf_file_url, source, status, created_at`;
// Use safe view that hides pdf_password — only exposes has_pdf_password boolean
const BILLING_COLS = `id, unit_id, billing_capture_email, forward_to_email, email_billing_enabled, setup_status, notes`;
const BILLING_TABLE = "unit_billing_email_settings";

export const invoiceService = {
  async listByUnit(unitId: string) {
    const { data, error } = await supabase
      .from("unit_invoices")
      .select(INVOICE_COLS)
      .eq("unit_id", unitId)
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });
    if (error) throw error;
    return data as UnitInvoice[];
  },

  async create(input: Partial<UnitInvoice>) {
    const { data, error } = await supabase.from("unit_invoices").insert(input as any).select(INVOICE_COLS).single();
    if (error) throw error;
    return data as UnitInvoice;
  },

  async getBillingSettings(unitId: string) {
    const { data, error } = await supabase
      .from("unit_billing_email_settings")
      .select(BILLING_COLS)
      .eq("unit_id", unitId)
      .maybeSingle();
    if (error) throw error;
    return data as BillingEmailSettings | null;
  },

  async upsertBillingSettings(unitId: string, input: Partial<BillingEmailSettings>) {
    // Separate pdf_password — use secure RPC
    const { pdf_password, ...safeInput } = input as any;

    const existing = await this.getBillingSettings(unitId);
    let result: BillingEmailSettings;

    if (existing) {
      const { data, error } = await supabase
        .from(BILLING_TABLE)
        .update(safeInput)
        .eq("id", existing.id)
        .select(BILLING_COLS)
        .single();
      if (error) throw error;
      result = data as BillingEmailSettings;
    } else {
      const { data, error } = await supabase
        .from(BILLING_TABLE)
        .insert({ ...safeInput, unit_id: unitId } as any)
        .select(BILLING_COLS)
        .single();
      if (error) throw error;
      result = data as BillingEmailSettings;
    }

    // Update pdf_password via secure RPC if provided
    if (pdf_password !== undefined) {
      await supabase.rpc("set_billing_pdf_password", {
        p_unit_id: unitId,
        p_password: pdf_password || "",
      });
    }

    return result;
  },
};
