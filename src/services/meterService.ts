/**
 * MeterService — Canonical service for meter devices.
 * SRP: CRUD + link management + readings.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MeterDevice {
  id: string;
  tenant_id: string;
  provider: string;
  integration_config_id: string | null;
  external_device_id: string;
  product_id: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  name: string;
  description: string | null;
  category: string | null;
  firmware_version: string | null;
  online_status: string | null;
  health_status: string | null;
  bidirectional_supported: boolean;
  supports_import_energy: boolean;
  supports_export_energy: boolean;
  supports_power: boolean;
  installed_at: string | null;
  last_seen_at: string | null;
  last_reading_at: string | null;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  leitura_inicial_03: number | null;
  leitura_inicial_103: number | null;
  leitura_inicial_data: string | null;
  leitura_inicial_observacao: string | null;
}

export interface MeterReading {
  id: string;
  meter_device_id: string;
  measured_at: string;
  voltage_v: number | null;
  current_a: number | null;
  power_w: number | null;
  energy_import_kwh: number | null;
  energy_export_kwh: number | null;
}

export interface UnitMeterLink {
  id: string;
  unit_id: string;
  meter_device_id: string;
  link_type: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
}

const METER_COLS = `id, tenant_id, provider, integration_config_id, external_device_id, product_id, model, manufacturer, serial_number, name, description, category, firmware_version, online_status, health_status, bidirectional_supported, supports_import_energy, supports_export_energy, supports_power, installed_at, last_seen_at, last_reading_at, metadata, is_active, created_at, updated_at, leitura_inicial_03, leitura_inicial_103, leitura_inicial_data, leitura_inicial_observacao`;

export const meterService = {
  async list(filters?: { provider?: string; online_status?: string; search?: string }) {
    let q = supabase.from("meter_devices").select(METER_COLS).order("name");
    if (filters?.provider && filters.provider !== "all") q = q.eq("provider", filters.provider);
    if (filters?.online_status && filters.online_status !== "all") q = q.eq("online_status", filters.online_status);
    if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,external_device_id.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data as MeterDevice[];
  },

  async getById(id: string) {
    const { data, error } = await supabase.from("meter_devices").select(METER_COLS).eq("id", id).single();
    if (error) throw error;
    return data as MeterDevice;
  },

  async getLinksForUnit(unitId: string) {
    const { data, error } = await supabase
      .from("unit_meter_links")
      .select("id, unit_id, meter_device_id, link_type, started_at, ended_at, is_active, notes")
      .eq("unit_id", unitId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data as UnitMeterLink[];
  },

  async getLinksForMeter(meterId: string) {
    const { data, error } = await supabase
      .from("unit_meter_links")
      .select("id, unit_id, meter_device_id, link_type, started_at, ended_at, is_active, notes")
      .eq("meter_device_id", meterId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data as UnitMeterLink[];
  },

  async linkToUnit(unitId: string, meterId: string, linkType: string = "principal") {
    // Use atomic RPC to prevent duplicate active principal links
    const { data, error } = await supabase.rpc("link_meter_to_unit", {
      p_unit_id: unitId,
      p_meter_device_id: meterId,
      p_link_type: linkType,
    });
    if (error) throw error;
    return { id: data, unit_id: unitId, meter_device_id: meterId, link_type: linkType, started_at: new Date().toISOString(), ended_at: null, is_active: true, notes: null } as UnitMeterLink;
  },

  async unlinkFromUnit(linkId: string) {
    const { error } = await supabase
      .from("unit_meter_links")
      .update({ is_active: false, ended_at: new Date().toISOString() } as any)
      .eq("id", linkId);
    if (error) throw error;
  },

  async getLatestReadings(meterId: string, limit = 24) {
    const { data, error } = await supabase
      .from("meter_readings")
      .select("id, meter_device_id, measured_at, voltage_v, current_a, power_w, power_factor, energy_import_kwh, energy_export_kwh")
      .eq("meter_device_id", meterId)
      .order("measured_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as MeterReading[];
  },

  /** Daily aggregated readings (one row per day with consumption/injection delta) */
  async getDailyReadings(meterId: string, limit = 60) {
    const { data, error } = await supabase
      .from("meter_readings_daily" as any)
      .select("id, meter_device_id, reading_date, measured_at, consumo_dia_kwh, injecao_dia_kwh, energy_import_kwh, energy_export_kwh, readings_count")
      .eq("meter_device_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as any[];
  },

  async getStatusLatest(meterId: string) {
    const { data, error } = await supabase
      .from("meter_status_latest")
      .select("meter_device_id, measured_at, online_status, voltage_v, current_a, power_w, energy_import_kwh, energy_export_kwh, energy_total_kwh, energy_balance_kwh, reactive_power_kvar, power_factor, leakage_current_ma, neutral_current_a, temperature_c, status_a, status_b, status_c, fault_bitmap, over_current_count, lost_current_count, leak_count, raw_payload, updated_at")
      .eq("meter_device_id", meterId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getAvailableMeters() {
    // Meters not actively linked to any UC
    const { data: linkedMeterIds } = await supabase
      .from("unit_meter_links")
      .select("meter_device_id")
      .eq("is_active", true);
    
    const linked = new Set((linkedMeterIds || []).map(l => l.meter_device_id));
    
    const { data: allMeters, error } = await supabase
      .from("meter_devices")
      .select(METER_COLS)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    
    return (allMeters || []).filter(m => !linked.has(m.id)) as MeterDevice[];
  },

  async updateLeituraInicial(id: string, payload: {
    leitura_inicial_03: number;
    leitura_inicial_103: number;
    leitura_inicial_data: string | null;
    leitura_inicial_observacao: string | null;
  }) {
    const { error } = await supabase
      .from("meter_devices")
      .update(payload as any)
      .eq("id", id);
    if (error) throw error;
  },
};
