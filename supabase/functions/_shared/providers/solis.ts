/**
 * SolisCloud Platform API V2.0 Adapter
 * Doc: https://solis-service.solisinverters.com/en/support
 *
 * Auth: HMAC-SHA1 signature per request (no token)
 * Plants: POST /v1/api/userStationList
 * Metrics: POST /v1/api/stationDetail
 * Devices: POST /v1/api/inverterList
 * Alarms: POST /v1/api/alarmList
 */
import {
  ProviderHttpClient,
  md5Base64,
  hmacSha1Base64,
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type NormalizedDeviceGroup,
  type NormalizedAlarm,
  type DailyMetrics,
} from "../provider-core/index.ts";

const SOLIS_BASE = "https://www.soliscloud.com:13333";

const STATUS_MAP: Record<string, string> = {
  "1": "normal", "2": "offline", "3": "alarm", "4": "no_communication",
};

export class SolisAdapter implements ProviderAdapter {
  readonly providerId = "solis_cloud";

  validateCredentials(creds: Record<string, string>): void {
    if (!creds.apiId) throw new Error("Missing: apiId (KeyID)");
    if (!creds.apiSecret) throw new Error("Missing: apiSecret (KeySecret)");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const { apiId, apiSecret } = creds;

    // Solis uses per-request HMAC signing; "authenticate" = verify credentials work
    await this.solisFetch(apiId, apiSecret, "/v1/api/userStationList", { pageNo: 1, pageSize: 1 });

    return {
      credentials: { apiId, apiSecret },
      tokens: { apiSecret },
    };
  }

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const { apiId } = auth.credentials as { apiId: string };
    const apiSecret = auth.tokens.apiSecret as string;
    const plants: NormalizedPlant[] = [];
    let pageNo = 1;

    while (true) {
      if (pageNo > 1) await this.rateDelay();
      const json = await this.solisFetch(apiId, apiSecret, "/v1/api/userStationList", { pageNo, pageSize: 100 });
      const data = json.data as any;
      const records = data?.page?.records || data?.records || [];
      if (!records.length) break;

      for (const r of records) {
        plants.push({
          external_id: String(r.id || r.sno || ""),
          name: String(r.stationName || r.sno || ""),
          capacity_kw: (r.installedCapacity ?? r.capacity) != null ? Number(r.installedCapacity ?? r.capacity) : null,
          address: r.city ? String(r.city) : null,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          status: STATUS_MAP[String(r.state)] || "unknown",
          metadata: r,
        });
      }

      if (pageNo * 100 >= Number(data?.page?.total || 0)) break;
      pageNo++;
    }
    return plants;
  }

  async fetchMetrics(auth: AuthResult, externalPlantId: string): Promise<DailyMetrics> {
    const { apiId } = auth.credentials as { apiId: string };
    const apiSecret = auth.tokens.apiSecret as string;

    try {
      let d: any = null;
      try {
        const detailJson = await this.solisFetch(apiId, apiSecret, "/v1/api/stationDetail", { id: externalPlantId });
        d = detailJson.data;
      } catch {
        const dayJson = await this.solisFetch(apiId, apiSecret, "/v1/api/stationDay", {
          id: externalPlantId, money: "CNY", time: new Date().toISOString().slice(0, 10), timeZone: 0,
        });
        d = dayJson.data;
      }

      const eToday = d?.dayEnergy ?? d?.eToday ?? d?.e_today ?? d?.todayEnergy ?? null;
      const eTotal = d?.allEnergy ?? d?.eTotal ?? d?.e_total ?? d?.totalEnergy ?? null;
      const pac = d?.pac ?? d?.power ?? d?.currentPower ?? null;

      return {
        power_kw: pac != null ? (Number(pac) > 100 ? Number(pac) / 1000 : Number(pac)) : null,
        energy_kwh: eToday != null ? Number(eToday) : null,
        total_energy_kwh: eTotal != null ? Number(eTotal) : null,
        metadata: d || {},
      };
    } catch {
      return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
    }
  }

  async fetchDevices(auth: AuthResult): Promise<NormalizedDeviceGroup[]> {
    const { apiId } = auth.credentials as { apiId: string };
    const apiSecret = auth.tokens.apiSecret as string;
    const result: NormalizedDeviceGroup[] = [];
    let pageNo = 1;

    while (true) {
      if (pageNo > 1) await this.rateDelay();
      const json = await this.solisFetch(apiId, apiSecret, "/v1/api/inverterList", { pageNo, pageSize: 100 });
      const data = json.data as any;
      const records = data?.page?.records || data?.records || [];
      if (!records.length) break;

      for (const r of records) {
        const stationId = String(r.stationId || r.plantId || "");
        const sn = r.sn || r.inverterSn || null;

        // Enrich with Vpv/Ipv from inverterDetail
        let detailMeta: Record<string, unknown> = {};
        if (sn) {
          try {
            await this.rateDelay();
            const detailJson = await this.solisFetch(apiId, apiSecret, "/v1/api/inverterDetail", { sn });
            const dd = detailJson.data || {};
            detailMeta = {
              vpv1: dd.uPv1 ?? dd.vpv1 ?? null, ipv1: dd.iPv1 ?? dd.ipv1 ?? null, ppv1: dd.pow1 ?? dd.ppv1 ?? null,
              vpv2: dd.uPv2 ?? dd.vpv2 ?? null, ipv2: dd.iPv2 ?? dd.ipv2 ?? null, ppv2: dd.pow2 ?? dd.ppv2 ?? null,
              vpv3: dd.uPv3 ?? dd.vpv3 ?? null, ipv3: dd.iPv3 ?? dd.ipv3 ?? null, ppv3: dd.pow3 ?? dd.ppv3 ?? null,
              vpv4: dd.uPv4 ?? dd.vpv4 ?? null, ipv4: dd.iPv4 ?? dd.ipv4 ?? null, ppv4: dd.pow4 ?? dd.ppv4 ?? null,
              pac: dd.pac ?? null, etoday: dd.eToday ?? null, etotal: dd.eTotal ?? null,
              dcInputTypeMppt: dd.mpptCount ?? dd.dcInputType ?? null,
            };
          } catch (e) { console.warn(`[Solis] inverterDetail failed for ${sn}`); }
        }

        const device = {
          provider_device_id: String(r.id || r.sn || ""),
          type: "inverter",
          model: r.inverterType || r.model || null,
          serial: sn,
          status: r.state === 1 ? "online" : r.state === 2 ? "offline" : r.state === 3 ? "alarm" : "unknown",
          metadata: { ...r, ...detailMeta },
        };
        const existing = result.find((x) => x.stationId === stationId);
        if (existing) existing.devices.push(device);
        else result.push({ stationId, devices: [device] });
      }

      if (pageNo * 100 >= Number(data?.page?.total || 0)) break;
      pageNo++;
    }
    return result;
  }

  async fetchAlarms(auth: AuthResult): Promise<NormalizedAlarm[]> {
    const { apiId } = auth.credentials as { apiId: string };
    const apiSecret = auth.tokens.apiSecret as string;
    const alarms: NormalizedAlarm[] = [];
    let pageNo = 1;

    while (true) {
      if (pageNo > 1) await this.rateDelay();
      const json = await this.solisFetch(apiId, apiSecret, "/v1/api/alarmList", { pageNo, pageSize: 100 });
      const data = json.data as any;
      const records = data?.page?.records || data?.records || [];
      if (!records.length) break;

      for (const r of records) {
        const level = String(r.alarmLevel || r.level || "").toLowerCase();
        const severity = level === "1" || level === "critical" ? "critical" as const : level === "2" || level === "major" ? "warn" as const : "info" as const;
        alarms.push({
          provider_event_id: String(r.id || r.alarmId || `${r.sn}_${r.alarmBeginTime}`),
          provider_plant_id: String(r.stationId || r.plantId || ""),
          provider_device_id: r.sn || r.inverterSn || null,
          severity,
          type: r.alarmCode ? "inverter_fault" : "other",
          title: r.alarmMsg || r.alarmMessage || r.alarmCode || "Alarme Solis",
          message: [r.alarmMsg, r.alarmCode, r.sn].filter(Boolean).join(" | "),
          starts_at: r.alarmBeginTime ? new Date(Number(r.alarmBeginTime)).toISOString() : new Date().toISOString(),
          ends_at: r.alarmEndTime ? new Date(Number(r.alarmEndTime)).toISOString() : null,
          is_open: !r.alarmEndTime,
        });
      }

      if (pageNo * 100 >= Number(data?.page?.total || 0)) break;
      pageNo++;
    }
    return alarms;
  }

  // ─── Solis HMAC Signed Request ─────────────────────────
  private async solisFetch(apiId: string, apiSecret: string, path: string, body: Record<string, unknown>): Promise<Record<string, any>> {
    const bodyStr = JSON.stringify(body);
    const contentMd5 = await md5Base64(bodyStr);
    const ct = "application/json";
    const dateStr = new Date().toUTCString();
    const sign = await hmacSha1Base64(apiSecret, `POST\n${contentMd5}\n${ct}\n${dateStr}\n${path}`);

    const res = await fetch(`${SOLIS_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        "Content-MD5": contentMd5,
        Date: dateStr,
        Authorization: `API ${apiId}:${sign}`,
      },
      body: bodyStr,
    });

    const json = await res.json();
    const isOk = json.success === true || json.code === "0" || json.code === 0;
    if (!isOk) throw new Error(json.msg || `Solis error (code=${json.code})`);
    return json;
  }

  /** Rate limit: minimum 2s between Solis API calls */
  private rateDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
