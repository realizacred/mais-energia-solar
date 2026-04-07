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

/**
 * Decode Base64 string to hex string.
 * Tuya Raw DPs come as Base64-encoded binary data.
 */
function base64ToHex(b64: string): string {
  try {
    const binary = atob(b64);
    return Array.from(binary, (ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

/**
 * Parse Tuya Raw phase DP (Base64-encoded) into voltage, current, power.
 * Format for smart breakers (8 bytes): 2B voltage (÷10=V) + 3B current (÷1000=A) + 3B power (W).
 */
function parsePhaseRaw(rawValue: string): { voltage: number; current: number; power: number } | null {
  if (!rawValue || typeof rawValue !== "string") return null;
  try {
    // Tuya Raw DPs are Base64-encoded
    const hex = base64ToHex(rawValue);
    if (hex.length < 12) return null;

    // Layout: 2B voltage + 3B current + 3B power = 8 bytes = 16 hex chars
    if (hex.length >= 16) {
      const voltage = parseInt(hex.substring(0, 4), 16) / 10;
      const current = parseInt(hex.substring(4, 10), 16) / 1000;
      const power = parseInt(hex.substring(10, 16), 16);
      if (voltage >= 0 && voltage <= 500 && current >= 0 && current <= 300) {
        return { voltage, current, power };
      }
    }
    // Fallback: shorter layout 2B + 2B + 2B = 12 hex chars
    if (hex.length >= 12) {
      const voltage = parseInt(hex.substring(0, 4), 16) / 10;
      const current = parseInt(hex.substring(4, 8), 16) / 1000;
      const power = parseInt(hex.substring(8, 12), 16);
      if (voltage >= 0 && voltage <= 500 && current >= 0 && current <= 300) {
        return { voltage, current, power };
      }
    }
    return null;
  } catch {
    return null;
  }
}

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
    // Handle Raw phase DPs (smart breakers: phase_a, phase_b, phase_c)
    if ((dp.code === "phase_a" || dp.code === "phase_b" || dp.code === "phase_c") && typeof dp.value === "string") {
      const parsed = parsePhaseRaw(dp.value);
      if (parsed && dp.code === "phase_a") {
        // Use phase_a as primary reading (single-phase or first phase)
        reading.voltage_v = reading.voltage_v ?? parsed.voltage;
        reading.current_a = reading.current_a ?? parsed.current;
        reading.power_w = reading.power_w ?? parsed.power;
      }
      continue;
    }

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
    name: raw.name || raw.devName || "Dispositivo desconhecido",
    model: raw.model || null,
    manufacturer: raw.manufacturer || "Tuya",
    product_id: raw.product_id || raw.productId || null,
    category: raw.category || null,
    serial_number: raw.id || raw.sn || raw.uuid || null,
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
      // Get tenant_id from the config so we can insert with correct tenant
      const { data: configData } = await supabase
        .from("integrations_api_configs")
        .select("tenant_id")
        .eq("id", configId)
        .single();
      const tenantId = configData?.tenant_id;

      // Pass known device IDs as fallback so the proxy can try direct fetch
      const resp = await this.callProxy("get_devices", configId, {
        known_device_ids: ["ebbe88c2fd12dac6feajsg"],
      });

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
            const { error: insertErr } = await supabase
              .from("meter_devices")
              .insert({
                ...normalized,
                provider: "tuya",
                integration_config_id: configId,
                tenant_id: tenantId,
                raw_device: raw,
                metadata: {},
                is_active: true,
              } as any);
            if (insertErr) throw insertErr;
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
        .select("id, external_device_id, tenant_id")
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
              tenant_id: meter.tenant_id,
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
              tenant_id: meter.tenant_id,
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

  /** Send command to a Tuya device (e.g., switch on/off) */
  async sendCommand(configId: string, deviceId: string, commands: { code: string; value: any }[]) {
    return this.callProxy("send_command", configId, { device_id: deviceId, commands });
  },

  /** Rename a Tuya device via API and update local DB */
  async renameDevice(configId: string, deviceExternalId: string, meterId: string, newName: string) {
    await this.callProxy("rename_device", configId, { device_id: deviceExternalId, name: newName });
    // Also update local DB
    const { error } = await supabase.from("meter_devices").update({ name: newName, updated_at: new Date().toISOString() } as any).eq("id", meterId);
    if (error) throw error;
  },

  /** Get device functions (DPs) */
  async getDeviceFunctions(configId: string, deviceId: string) {
    return this.callProxy("get_device_functions", configId, { device_id: deviceId });
  },

  /** Trigger server-side readings sync */
  async syncReadings(configId: string) {
    return this.callProxy("sync_readings", configId);
  },

  /** Get alerts for a meter */
  async getAlerts(meterId: string, resolvedFilter?: boolean) {
    let q = supabase
      .from("meter_alerts")
      .select("*")
      .eq("meter_device_id", meterId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (resolvedFilter !== undefined) q = q.eq("resolvido", resolvedFilter);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  /** Resolve an alert */
  async resolveAlert(alertId: string) {
    const { error } = await supabase
      .from("meter_alerts")
      .update({ resolvido: true, resolvido_at: new Date().toISOString() } as any)
      .eq("id", alertId);
    if (error) throw error;
  },
};
