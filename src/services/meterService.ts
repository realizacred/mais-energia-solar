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

const METER_COLS = `id, tenant_id, provider, integration_config_id, external_device_id, product_id, model, manufacturer, serial_number, name, description, category, firmware_version, online_status, health_status, bidirectional_supported, supports_import_energy, supports_export_energy, supports_power, installed_at, last_seen_at, last_reading_at, metadata, is_active, created_at, updated_at`;

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
      .select("id, meter_device_id, measured_at, voltage_v, current_a, power_w, energy_import_kwh, energy_export_kwh")
      .eq("meter_device_id", meterId)
      .order("measured_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as MeterReading[];
  },

  async getStatusLatest(meterId: string) {
    const { data, error } = await supabase
      .from("meter_status_latest")
      .select("meter_device_id, measured_at, online_status, voltage_v, current_a, power_w, energy_import_kwh, energy_export_kwh, updated_at")
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
};
