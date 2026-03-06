/**
 * TuyaIntegrationService — Client-side service for Tuya integration operations.
 * All real API calls go through the tuya-proxy Edge Function (server-side).
 * SRP: Orchestrates sync operations, normalization, and DB persistence.
 */
import { supabase } from "@/integrations/supabase/client";
import { syncLogger, type SyncRunInput } from "@/utils/syncLogger";

// ─── Tuya Data Point Normalization ───────────────────────────────
// Tuya devices report DPS (Data Points). Energy meters commonly use these codes:
// Different models/product_ids may use different DPS codes.

interface TuyaDPS {
  code: string;
  value: any;
}

interface NormalizedReading {
  voltage_v: number | null;
  current_a: number | null;
  power_w: number | null;
  energy_import_kwh: number | null;
  energy_export_kwh: number | null;
  frequency_hz: number | null;
  power_factor: number | null;
  online_status: string;
}

/** Known DPS code mappings for energy meters */
const DPS_MAP: Record<string, keyof NormalizedReading> = {
  // Common Tuya energy meter codes
  cur_voltage: "voltage_v",
  phase_a_voltage: "voltage_v",
  voltage_a: "voltage_v",
  cur_current: "current_a",
  phase_a_current: "current_a",
  current_a: "current_a",
  cur_power: "power_w",
  phase_a_power: "power_w",
  total_power: "power_w",
  add_ele: "energy_import_kwh",
  total_forward_energy: "energy_import_kwh",
  forward_energy_total: "energy_import_kwh",
  ele_consumption: "energy_import_kwh",
  reverse_energy_total: "energy_export_kwh",
  total_reverse_energy: "energy_export_kwh",
  freq: "frequency_hz",
  power_factor: "power_factor",
};

/** Scale factors: some Tuya values are in mV, mA, mW, or *10 */
const SCALE_MAP: Record<string, number> = {
  voltage_v: 0.1, // Tuya reports in 0.1V
  current_a: 0.001, // Tuya reports in mA
  power_w: 1, // Usually in W
  energy_import_kwh: 0.01, // Usually in 0.01 kWh
  energy_export_kwh: 0.01,
  frequency_hz: 0.01,
  power_factor: 0.01,
};

function normalizeDPS(dps: TuyaDPS[], deviceInfo?: any): NormalizedReading {
  const reading: NormalizedReading = {
    voltage_v: null,
    current_a: null,
    power_w: null,
    energy_import_kwh: null,
    energy_export_kwh: null,
    frequency_hz: null,
    power_factor: null,
    online_status: deviceInfo?.online ? "online" : "offline",
  };

  for (const dp of dps) {
    const field = DPS_MAP[dp.code];
    if (field && field !== "online_status" && typeof dp.value === "number") {
      const scale = SCALE_MAP[field] ?? 1;
      (reading as any)[field] = dp.value * scale;
    }
  }

  return reading;
}

function normalizeDevice(raw: any) {
  return {
    external_device_id: raw.id || raw.devId || "",
    name: raw.name || raw.devName || "Unknown Device",
    model: raw.model || null,
    manufacturer: raw.manufacturer || "Tuya",
    product_id: raw.product_id || raw.productId || null,
    category: raw.category || null,
    serial_number: raw.sn || raw.uuid || null,
    firmware_version: raw.sw_ver || null,
    online_status: raw.online ? "online" : "offline",
    bidirectional_supported: false, // Will be updated based on DPS
    supports_import_energy: true,
    supports_export_energy: false, // Will be updated based on DPS
    supports_power: true,
  };
}

// ─── Service ─────────────────────────────────────────────────────

export const tuyaIntegrationService = {
  /** Call the tuya-proxy edge function */
  async callProxy(action: string, configId: string, params?: any) {
    const { data, error } = await supabase.functions.invoke("tuya-proxy", {
      body: { action, config_id: configId, params },
    });
    if (error) throw new Error(`Proxy error: ${error.message}`);
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /** Test connection to Tuya Cloud */
  async testConnection(configId: string) {
    const result = await this.callProxy("test_connection", configId);
    return { success: result.success, message: result.success ? "Conexão OK" : (result.msg || "Falha na autenticação") };
  },

  /** Sync devices from Tuya Cloud into meter_devices */
  async syncDevices(configId: string) {
    const run = await syncLogger.start({
      provider: "tuya",
      sync_type: "devices",
      integration_config_id: configId,
    });

    try {
      const resp = await this.callProxy("get_devices", configId);

      if (!resp.success && !resp.result?.length) {
        throw new Error(resp.msg || "Failed to fetch devices");
      }

      const devices = resp.result || [];
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const raw of devices) {
        try {
          const normalized = normalizeDevice(raw);

          // Check if DPS suggest export capability
          if (raw.status) {
            const codes = (raw.status as any[]).map((s: any) => s.code);
            if (codes.some((c: string) => c.includes("reverse") || c.includes("export"))) {
              normalized.supports_export_energy = true;
              normalized.bidirectional_supported = true;
            }
          }

          // Upsert by external_device_id + provider
          const { data: existing } = await supabase
            .from("meter_devices")
            .select("id")
            .eq("external_device_id", normalized.external_device_id)
            .eq("provider", "tuya")
            .maybeSingle();

          if (existing) {
            await supabase
              .from("meter_devices")
              .update({
                ...normalized,
                integration_config_id: configId,
                raw_device: raw,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", existing.id);
            updated++;
          } else {
            await supabase
              .from("meter_devices")
              .insert({
                ...normalized,
                provider: "tuya",
                integration_config_id: configId,
                raw_device: raw,
                metadata: {},
                is_active: true,
              } as any);
            created++;
          }
        } catch (e: any) {
          console.error("[TuyaSync] Device error:", e.message);
          failed++;
        }
      }

      // Update last_sync_at on config
      await supabase
        .from("integrations_api_configs")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq("id", configId);

      await syncLogger.finish(run.id, {
        items_processed: devices.length,
        items_created: created,
        items_updated: updated,
        items_failed: failed,
      });

      return { total: devices.length, created, updated, failed };
    } catch (err: any) {
      await syncLogger.error(run.id, err.message);
      throw err;
    }
  },

  /** Sync status/readings for all meters linked to a config (or a specific device) */
  async syncDeviceStatus(configId: string, specificDeviceId?: string) {
    const run = await syncLogger.start({
      provider: "tuya",
      sync_type: "readings",
      integration_config_id: configId,
    });

    try {
      // Get meters for this config
      let query = supabase
        .from("meter_devices")
        .select("id, external_device_id")
        .eq("integration_config_id", configId)
        .eq("is_active", true);

      if (specificDeviceId) {
        query = query.eq("id", specificDeviceId);
      }

      const { data: meters } = await query;
      if (!meters?.length) {
        await syncLogger.finish(run.id, { items_processed: 0 });
        return { processed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const meter of meters) {
        try {
          const resp = await this.callProxy("get_device_status", configId, {
            device_id: meter.external_device_id,
          });

          if (!resp.success) {
            failed++;
            continue;
          }

          const dps: TuyaDPS[] = resp.result?.status || [];
          const deviceInfo = resp.result?.device_info || {};
          const normalized = normalizeDPS(dps, deviceInfo);
          const now = new Date().toISOString();

          // Upsert meter_status_latest
          await supabase
            .from("meter_status_latest")
            .upsert({
              meter_device_id: meter.id,
              measured_at: now,
              online_status: normalized.online_status,
              voltage_v: normalized.voltage_v,
              current_a: normalized.current_a,
              power_w: normalized.power_w,
              energy_import_kwh: normalized.energy_import_kwh,
              energy_export_kwh: normalized.energy_export_kwh,
              raw_payload: { dps, device_info: deviceInfo },
              updated_at: now,
            } as any, { onConflict: "meter_device_id" });

          // Insert meter_readings
          await supabase
            .from("meter_readings")
            .insert({
              meter_device_id: meter.id,
              measured_at: now,
              voltage_v: normalized.voltage_v,
              current_a: normalized.current_a,
              power_w: normalized.power_w,
              energy_import_kwh: normalized.energy_import_kwh,
              energy_export_kwh: normalized.energy_export_kwh,
              frequency_hz: normalized.frequency_hz,
              power_factor: normalized.power_factor,
              raw_payload: { dps, device_info: deviceInfo },
            } as any);

          // Update meter device timestamps
          await supabase
            .from("meter_devices")
            .update({
              online_status: normalized.online_status,
              last_seen_at: deviceInfo.online ? now : undefined,
              last_reading_at: now,
              updated_at: now,
            } as any)
            .eq("id", meter.id);

          processed++;
        } catch (e: any) {
          console.error("[TuyaSync] Status error for", meter.external_device_id, e.message);
          failed++;
        }
      }

      // Update last_sync_at on config
      await supabase
        .from("integrations_api_configs")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq("id", configId);

      await syncLogger.finish(run.id, {
        items_processed: meters.length,
        items_updated: processed,
        items_failed: failed,
      });

      return { processed, failed, total: meters.length };
    } catch (err: any) {
      await syncLogger.error(run.id, err.message);
      throw err;
    }
  },

  /** Full sync: devices + readings */
  async syncAll(configId: string) {
    const devResult = await this.syncDevices(configId);
    const statusResult = await this.syncDeviceStatus(configId);
    return { devices: devResult, readings: statusResult };
  },

  /** Get sync logs for a config */
  async getSyncLogs(configId: string, limit = 10) {
    const { data, error } = await supabase
      .from("integration_sync_runs")
      .select("*")
      .eq("integration_config_id", configId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  /** Count meters imported for a config */
  async getImportedMeterCount(configId: string) {
    const { count, error } = await supabase
      .from("meter_devices")
      .select("id", { count: "exact", head: true })
      .eq("integration_config_id", configId)
      .eq("is_active", true);
    if (error) throw error;
    return count || 0;
  },
};
