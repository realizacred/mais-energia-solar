/**
 * InvoiceService — Canonical service for UC invoices and billing email settings.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export type BandeiraTarifaria = "verde" | "amarela" | "vermelha_1" | "vermelha_2";

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
  demanda_contratada_kw: number | null;
  demanda_medida_kw: number | null;
  ultrapassagem_kw: number | null;
  multa_ultrapassagem: number | null;
  bandeira_tarifaria: BandeiraTarifaria | null;
}

export type BillingNotificationChannel = "whatsapp" | "email" | "ambos";

export interface BillingEmailSettings {
  id: string;
  unit_id: string;
  billing_capture_email: string | null;
  forward_to_email: string | null;
  /** Never returned from read — write-only via secure RPC */
  pdf_password?: string | null;
  email_billing_enabled: boolean;
  setup_status: string;
  notes: string | null;
  dia_leitura: number | null;
  dias_antecedencia_alerta: number;
  canal_notificacao: BillingNotificationChannel;
  servico_fatura_ativo: boolean;
}

const INVOICE_COLS = `id, unit_id, reference_month, reference_year, due_date, total_amount, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, previous_balance_kwh, current_balance_kwh, pdf_file_url, source, status, created_at, demanda_contratada_kw, demanda_medida_kw, ultrapassagem_kw, multa_ultrapassagem, bandeira_tarifaria`;
// Use safe view that hides pdf_password — only exposes has_pdf_password boolean
const BILLING_COLS = `id, unit_id, billing_capture_email, forward_to_email, email_billing_enabled, setup_status, notes, dia_leitura, dias_antecedencia_alerta, canal_notificacao, servico_fatura_ativo`;
const BILLING_TABLE = "unit_billing_email_settings";

export const invoiceService = {
  /** List all invoices across all UCs (for central view) */
  async listAll(filters?: { unit_id?: string; status?: string; reference_year?: number; limit?: number }) {
    let q = supabase
      .from("unit_invoices")
      .select(`${INVOICE_COLS}, units_consumidoras!inner(nome, codigo_uc, concessionaria_nome, cliente_id)`)
      .order("reference_year", { ascending: false })
      .order("reference_month", { ascending: false });
    if (filters?.unit_id) q = q.eq("unit_id", filters.unit_id);
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.reference_year) q = q.eq("reference_year", filters.reference_year);
    q = q.limit(filters?.limit ?? 200);
    const { data, error } = await q;
    if (error) throw error;
    return data as (UnitInvoice & { units_consumidoras: { nome: string; codigo_uc: string; concessionaria_nome: string | null; cliente_id: string | null } })[];
  },

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

  /** Check if a duplicate invoice exists */
  async checkDuplicate(unitId: string, refMonth: number, refYear: number): Promise<boolean> {
    const { data } = await supabase
      .from("unit_invoices")
      .select("id")
      .eq("unit_id", unitId)
      .eq("reference_month", refMonth)
      .eq("reference_year", refYear)
      .neq("status", "deleted")
      .limit(1);
    return (data?.length ?? 0) > 0;
  },

  async create(input: Partial<UnitInvoice>) {
    const { tenantId } = await getCurrentTenantId();
    const payload = { ...input, tenant_id: tenantId };
    const { data, error } = await supabase.from("unit_invoices").insert(payload as any).select(INVOICE_COLS).single();
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

  async delete(invoiceId: string) {
    const { error } = await supabase.from("unit_invoices").delete().eq("id", invoiceId);
    if (error) throw error;
  },
};
