import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// All providers with real sync logic
const SYNC_IMPLEMENTED = new Set([
  "solarman_business_api", "solarman_business", "solaredge", "solis_cloud", "deye_cloud",
  "growatt", "hoymiles", "sungrow", "huawei", "goodwe", "fronius",
  "fox_ess", "solax", "saj", "shinemonitor", "apsystems", "enphase",
  "sunny_portal", "sofar", "kstar", "intelbras", "ecosolys",
  "csi_cloudpro", "csi_smart_energy", "csi_cloud",
]);

// ═══════════════════════════════════════════════════════════
// Shared types & crypto
// ═══════════════════════════════════════════════════════════

interface NormalizedPlant {
  external_id: string; name: string; capacity_kw: number | null;
  address: string | null; latitude: number | null; longitude: number | null;
  status: string; metadata: Record<string, unknown>;
}

interface DailyMetrics {
  power_kw: number | null; energy_kwh: number | null;
  total_energy_kwh: number | null; metadata: Record<string, unknown>;
}

async function md5Base64(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(text));
  return base64Encode(new Uint8Array(hash));
}

async function hmacSha1Base64(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64Encode(new Uint8Array(sig));
}

function normStatus(raw: number | string | undefined, map: Record<string, string>): string {
  return map[String(raw)] || "unknown";
}

const STATUS_MAP_NUMERIC = { "1": "normal", "2": "offline", "3": "alarm", "4": "no_communication" };
const today = () => new Date().toISOString().slice(0, 10);

// ═══════════════════════════════════════════════════════════
// Solarman Business API
// ═══════════════════════════════════════════════════════════

async function solarmanFetch(ep: string, token: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.solarmanpv.com${ep}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.msg || `Solarman ${res.status}`);
  return json;
}

async function solarmanListPlants(token: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let page = 1;
  while (true) {
    const json = await solarmanFetch("/station/v1.0/list", token, { page, size: 100 });
    const list = (json.stationList || json.data || []) as Record<string, unknown>[];
    if (!list.length) break;
    for (const r of list) {
      plants.push({
        external_id: String(r.stationId || r.id || ""), name: String(r.stationName || r.name || ""),
        capacity_kw: r.installedCapacity != null ? Number(r.installedCapacity) : null,
        address: r.locationAddress ? String(r.locationAddress) : null,
        latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
        status: normStatus(r.status as number, STATUS_MAP_NUMERIC), metadata: r,
      });
    }
    if (page * 100 >= (json.total as number || 0)) break;
    page++;
  }
  return plants;
}

async function solarmanMetrics(token: string, extId: string): Promise<DailyMetrics> {
  try {
    const json = await solarmanFetch("/station/v1.0/realTime", token, { stationId: Number(extId) });
    return {
      power_kw: json.generationPower != null ? Number(json.generationPower) / 1000 : null,
      energy_kwh: json.generationValue != null ? Number(json.generationValue) : null,
      total_energy_kwh: json.totalGenerationValue ?? json.generationTotal != null ? Number(json.totalGenerationValue ?? json.generationTotal) : null,
      metadata: json,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// SolarEdge
// ═══════════════════════════════════════════════════════════

const SE_BASE = "https://monitoringapi.solaredge.com";

async function solaredgeListSites(apiKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch(`${SE_BASE}/sites/list?api_key=${encodeURIComponent(apiKey)}&size=100`);
  if (!res.ok) throw new Error(`SolarEdge ${res.status}`);
  const json = await res.json();
  return ((json.sites?.site || []) as Record<string, unknown>[]).map((s) => ({
    external_id: String(s.id), name: String(s.name || ""),
    capacity_kw: s.peakPower != null ? Number(s.peakPower) : null,
    address: [s.address?.address, s.address?.city].filter(Boolean).join(", ") || null,
    latitude: (s.location as any)?.latitude != null ? Number((s.location as any).latitude) : null,
    longitude: (s.location as any)?.longitude != null ? Number((s.location as any).longitude) : null,
    status: (s.status as string)?.toLowerCase() === "active" ? "normal" : "offline",
    metadata: s,
  }));
}

async function solaredgeMetrics(apiKey: string, siteId: string): Promise<DailyMetrics> {
  try {
    const d = today();
    const [eRes, oRes] = await Promise.all([
      fetch(`${SE_BASE}/site/${siteId}/energy?timeUnit=DAY&startDate=${d}&endDate=${d}&api_key=${encodeURIComponent(apiKey)}`),
      fetch(`${SE_BASE}/site/${siteId}/overview?api_key=${encodeURIComponent(apiKey)}`),
    ]);
    let energyKwh: number | null = null, powerKw: number | null = null, totalKwh: number | null = null;
    if (eRes.ok) { const ej = await eRes.json(); const v = ej.energy?.values?.[0]?.value; energyKwh = v != null ? v / 1000 : null; }
    if (oRes.ok) { const oj = await oRes.json(); const ov = oj.overview; powerKw = ov?.currentPower?.power != null ? ov.currentPower.power / 1000 : null; totalKwh = ov?.lifeTimeData?.energy != null ? ov.lifeTimeData.energy / 1000 : null; }
    return { power_kw: powerKw, energy_kwh: energyKwh, total_energy_kwh: totalKwh, metadata: {} };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// SolisCloud Platform API V2.0
// ═══════════════════════════════════════════════════════════

async function solisFetch(apiId: string, apiSecret: string, path: string, body: Record<string, unknown>) {
  const bodyStr = JSON.stringify(body);
  const contentMd5 = await md5Base64(bodyStr);
  const ct = "application/json;charset=UTF-8";
  const dateStr = new Date().toUTCString();
  const sign = await hmacSha1Base64(apiSecret, `POST\n${contentMd5}\n${ct}\n${dateStr}\n${path}`);
  const res = await fetch(`https://www.soliscloud.com:13333${path}`, {
    method: "POST", headers: { "Content-Type": ct, "Content-MD5": contentMd5, Date: dateStr, Authorization: `API ${apiId}:${sign}` },
    body: bodyStr,
  });
  const json = await res.json();
  if (!json.success && json.code !== "0") throw new Error(json.msg || `Solis error`);
  return json;
}

async function solisListPlants(apiId: string, apiSecret: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let pageNo = 1;
  while (true) {
    const json = await solisFetch(apiId, apiSecret, "/v1/api/userStationList", { pageNo, pageSize: 100 });
    const data = json.data as any;
    const records = data?.page?.records || data?.records || [];
    if (!records.length) break;
    for (const r of records) {
      plants.push({
        external_id: String(r.id || r.sno || ""), name: String(r.stationName || r.sno || ""),
        capacity_kw: r.installedCapacity ?? r.capacity != null ? Number(r.installedCapacity ?? r.capacity) : null,
        address: r.city ? String(r.city) : null,
        latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
        status: normStatus(r.state, STATUS_MAP_NUMERIC), metadata: r,
      });
    }
    if (pageNo * 100 >= Number(data?.page?.total || 0)) break;
    pageNo++;
  }
  return plants;
}

async function solisMetrics(apiId: string, apiSecret: string, stationId: string): Promise<DailyMetrics> {
  try {
    const json = await solisFetch(apiId, apiSecret, "/v1/api/stationDay", { id: stationId, money: "CNY", time: today(), timeZone: 0 });
    const d = json.data as any;
    return {
      power_kw: d?.pac != null ? Number(d.pac) / 1000 : null,
      energy_kwh: d?.eToday ?? d?.dayEnergy != null ? Number(d.eToday ?? d.dayEnergy) : null,
      total_energy_kwh: d?.eTotal ?? d?.allEnergy != null ? Number(d.eTotal ?? d.allEnergy) : null,
      metadata: d || {},
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Deye Cloud
// ═══════════════════════════════════════════════════════════

async function deyeFetch(baseUrl: string, token: string, ep: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${baseUrl}${ep}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Deye non-JSON (${res.status}): ${text.slice(0, 200)}`); }
}

async function deyeListPlants(baseUrl: string, token: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let page = 1;
  while (true) {
    const json = await deyeFetch(baseUrl, token, "/station/list", { page, size: 200 });
    // Deye v2: stationList and total are at top level
    const list = json.stationList || json.data?.stationList || [];
    if (!Array.isArray(list) || !list.length) break;
    for (const r of list) {
      const connStatus = r.connectionStatus as string || "";
      let status = "unknown";
      if (connStatus === "NORMAL") status = "normal";
      else if (connStatus === "ALL_OFFLINE" || connStatus === "NO_DEVICE") status = "offline";
      else if (connStatus === "PARTIAL_OFFLINE") status = "alarm";
      plants.push({
        external_id: String(r.id || ""), name: String(r.name || ""),
        capacity_kw: r.installedCapacity != null ? Number(r.installedCapacity) : null,
        address: r.locationAddress || null,
        latitude: r.locationLat != null ? Number(r.locationLat) : null,
        longitude: r.locationLng != null ? Number(r.locationLng) : null,
        status, metadata: r,
      });
    }
    const total = json.total || json.data?.total || 0;
    if (page * 200 >= Number(total)) break;
    page++;
  }
  return plants;
}

async function deyeMetrics(baseUrl: string, token: string, extId: string): Promise<DailyMetrics> {
  try {
    const json = await deyeFetch(baseUrl, token, "/station/latest", { stationId: Number(extId) });
    // Deye v2: fields are at top level (generationPower, batterySOC, etc.)
    return {
      power_kw: json.generationPower != null ? Number(json.generationPower) : null,
      energy_kwh: null, // station/latest doesn't return daily energy directly
      total_energy_kwh: null,
      metadata: json,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Growatt — ShineServer (cookies) + OpenAPI Business (token)
// ═══════════════════════════════════════════════════════════

// ── ShineServer (legacy cookie auth) ──
async function growattListPlants(cookies: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://openapi.growatt.com/newPlantAPI.do?op=getAllPlantList&currPage=1&pageSize=100", {
    headers: { Cookie: cookies },
  });
  const json = await res.json();
  const list = (json.back?.data || json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.plantId || r.id || ""), name: String(r.plantName || r.name || ""),
    capacity_kw: r.nominalPower != null ? Number(r.nominalPower) : null,
    address: r.city || r.plantAddress || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === "1" || r.status === 1 ? "normal" : r.status === "0" ? "offline" : "unknown",
    metadata: r,
  }));
}

async function growattMetrics(cookies: string, plantId: string): Promise<DailyMetrics> {
  try {
    const res = await fetch(`https://openapi.growatt.com/newPlantAPI.do?op=getPlantData&plantId=${plantId}&type=1&date=${today()}`, {
      headers: { Cookie: cookies },
    });
    const json = await res.json();
    const d = json.back || json;
    return {
      power_kw: d.currentPower != null ? Number(d.currentPower) : null,
      energy_kwh: d.todayEnergy != null ? Number(d.todayEnergy) : null,
      total_energy_kwh: d.totalEnergy != null ? Number(d.totalEnergy) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ── OpenAPI Business (token header) ──
// Docs: token is a non-expiring key sent in "token" HTTP header
// v1 API: GET endpoints for plant listing
// v4 API: POST /v4/new-api/queryLastData with x-www-form-urlencoded body
async function growattApiListPlants(apiKey: string): Promise<NormalizedPlant[]> {
  const hdr = { "token": apiKey, "Content-Type": "application/x-www-form-urlencoded" };
  const allPlants: NormalizedPlant[] = [];

  function parsePlants(plants: any[], source: string): NormalizedPlant[] {
    return plants.map((r: any) => ({
      external_id: String(r.plant_id || r.plantId || r.id || ""),
      name: String(r.name || r.plantName || ""),
      capacity_kw: r.peak_power ?? r.nominalPower ?? r.capacity != null ? Number(r.peak_power ?? r.nominalPower ?? r.capacity) : null,
      address: r.city || r.plantAddress || r.address || null,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      status: (r.status === "1" || r.status === 1) ? "normal" : (r.status === "0" || r.status === 0 || r.status === "3") ? "offline" : "unknown",
      metadata: { ...r, _source: source },
    }));
  }

  // Strategy 1: POST /v1/user/c_user_list (business accounts)
  console.log("[Growatt API] Strategy 1: POST c_user_list...");
  try {
    const usersRes = await fetch("https://openapi.growatt.com/v1/user/c_user_list", {
      method: "POST", headers: hdr, body: "page=1&perpage=200",
    });
    const usersJson = await usersRes.json().catch(() => ({}));
    console.log("[Growatt API] c_user_list:", JSON.stringify(usersJson).slice(0, 500));
    const users = (usersJson.data?.c_user || []) as any[];

    for (const user of users) {
      const userId = user.c_user_id;
      if (!userId) continue;
      try {
        const pRes = await fetch("https://openapi.growatt.com/v1/plant/list", {
          method: "POST", headers: hdr, body: `c_user_id=${userId}&page=1&perpage=200`,
        });
        const pJson = await pRes.json().catch(() => ({}));
        const plants = pJson.data?.plants || [];
        allPlants.push(...parsePlants(plants, `c_user_${userId}`));
      } catch {}
    }
  } catch (e) { console.warn("[Growatt API] c_user_list failed:", (e as Error).message); }

  // Strategy 2: POST /v1/plant/list direct (personal / simple company accounts)
  if (allPlants.length === 0) {
    console.log("[Growatt API] Strategy 2: POST plant/list...");
    try {
      const res = await fetch("https://openapi.growatt.com/v1/plant/list", {
        method: "POST", headers: hdr, body: "page=1&perpage=200",
      });
      const json = await res.json().catch(() => ({}));
      console.log("[Growatt API] plant/list POST:", JSON.stringify(json).slice(0, 500));
      const plants = json.data?.plants || [];
      allPlants.push(...parsePlants(plants, "direct_post"));
    } catch (e) { console.warn("[Growatt API] plant/list POST failed:", (e as Error).message); }
  }

  // Strategy 3: GET /v1/plant/list (legacy fallback)
  if (allPlants.length === 0) {
    console.log("[Growatt API] Strategy 3: GET plant/list...");
    try {
      const res = await fetch("https://openapi.growatt.com/v1/plant/list?page=1&perpage=200", {
        headers: { "token": apiKey },
      });
      const json = await res.json().catch(() => ({}));
      console.log("[Growatt API] plant/list GET:", JSON.stringify(json).slice(0, 500));
      const plants = json.data?.plants || [];
      allPlants.push(...parsePlants(plants, "direct_get"));
    } catch (e) { console.warn("[Growatt API] plant/list GET failed:", (e as Error).message); }
  }

  // Strategy 4: ShineServer newPlantAPI.do with token (some Growatt versions support this)
  if (allPlants.length === 0) {
    console.log("[Growatt API] Strategy 4: ShineServer getAllPlantList...");
    for (const baseUrl of ["https://openapi.growatt.com", "https://server.growatt.com", "https://server-api.growatt.com"]) {
      try {
        const res = await fetch(`${baseUrl}/newPlantAPI.do?op=getAllPlantList&currPage=1&pageSize=200`, {
          headers: { "token": apiKey, Cookie: `onePlantId=0; token=${apiKey}` },
        });
        const text = await res.text();
        let json: any;
        try { json = JSON.parse(text); } catch { continue; }
        console.log(`[Growatt API] ShineServer ${baseUrl}:`, JSON.stringify(json).slice(0, 500));
        const list = (json.back?.data || json.data || []) as any[];
        if (list.length > 0) {
          allPlants.push(...parsePlants(list, `shineserver_${baseUrl}`));
          break;
        }
      } catch {}
    }
  }

  // Strategy 5: Try /v1/plant/user_plant_list (some API versions)
  if (allPlants.length === 0) {
    console.log("[Growatt API] Strategy 5: user_plant_list...");
    try {
      const res = await fetch("https://openapi.growatt.com/v1/plant/user_plant_list", {
        method: "POST", headers: hdr, body: "page=1&perpage=200",
      });
      const json = await res.json().catch(() => ({}));
      console.log("[Growatt API] user_plant_list:", JSON.stringify(json).slice(0, 500));
      const plants = json.data?.plants || json.data || [];
      if (Array.isArray(plants) && plants.length > 0) {
        allPlants.push(...parsePlants(plants, "user_plant_list"));
      }
    } catch {}
  }

  console.log(`[Growatt API] Total plants discovered: ${allPlants.length}`);
  return allPlants;
}

// Growatt v4 API: POST /v4/new-api/queryLastData
// Content-Type: application/x-www-form-urlencoded
// Header: token
// Body: deviceType=min&deviceSn=XXXX
// Response: { code: 0, data: { min: [{ ppv, pac, eacToday, eacTotal, status, ... }] } }
async function growattApiQueryLastData(apiKey: string, deviceSn: string, deviceType: string): Promise<DailyMetrics> {
  try {
    const res = await fetch("https://openapi.growatt.com/v4/new-api/queryLastData", {
      method: "POST",
      headers: {
        "token": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `deviceType=${encodeURIComponent(deviceType)}&deviceSn=${encodeURIComponent(deviceSn)}`,
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }

    console.log(`[Growatt v4] queryLastData response code=${json.code}, message=${json.message}`);

    if (json.code !== 0) {
      console.warn(`[Growatt v4] Error: ${json.message}`);
      return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: json };
    }

    // Data is nested under data.<deviceType>[0]
    const deviceData = json.data?.[deviceType]?.[0] || json.data || {};
    return {
      power_kw: deviceData.pac != null ? Number(deviceData.pac) / 1000 : (deviceData.ppv != null ? Number(deviceData.ppv) / 1000 : null),
      energy_kwh: deviceData.eacToday != null ? Number(deviceData.eacToday) : (deviceData.eToday != null ? Number(deviceData.eToday) : null),
      total_energy_kwh: deviceData.eacTotal != null ? Number(deviceData.eacTotal) : (deviceData.eTotal != null ? Number(deviceData.eTotal) : null),
      metadata: deviceData,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

async function growattApiMetrics(apiKey: string, plantId: string): Promise<DailyMetrics> {
  try {
    const hdr = { "token": apiKey };

    // First try v1 plant data for aggregate metrics
    const res = await fetch(`https://openapi.growatt.com/v1/plant/data?plant_id=${plantId}`, { headers: hdr });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
    const d = json.data || {};
    return {
      power_kw: d.current_power != null ? Number(d.current_power) : null,
      energy_kwh: d.today_energy != null ? Number(d.today_energy) : null,
      total_energy_kwh: d.total_energy != null ? Number(d.total_energy) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Hoymiles S-Miles
// ═══════════════════════════════════════════════════════════

async function hoymilesListPlants(token: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://global.hoymiles.com/platform/api/gateway/iam/station_list", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ page: 1, page_size: 100 }),
  });
  const json = await res.json();
  const list = (json.data?.list || json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.sid || r.id || ""), name: String(r.station_name || r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) / 1000 : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === 1 ? "normal" : r.status === 0 ? "offline" : "unknown",
    metadata: r,
  }));
}

async function hoymilesMetrics(token: string, sid: string): Promise<DailyMetrics> {
  try {
    const res = await fetch("https://global.hoymiles.com/platform/api/gateway/iam/station_data/real", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sid }),
    });
    const json = await res.json();
    const d = json.data || {};
    return {
      power_kw: d.real_power != null ? Number(d.real_power) / 1000 : null,
      energy_kwh: d.today_eq != null ? Number(d.today_eq) / 1000 : null,
      total_energy_kwh: d.total_eq != null ? Number(d.total_eq) / 1000 : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Sungrow iSolarCloud
// ═══════════════════════════════════════════════════════════

async function sungrowListPlants(token: string, appKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://gateway.isolarcloud.com/v1/powerStationService/getPsList", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appkey: appKey, token, curPage: 1, size: 100 }),
  });
  const json = await res.json();
  const list = (json.result_data?.pageList || json.result_data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.ps_id || r.id || ""), name: String(r.ps_name || r.name || ""),
    capacity_kw: r.installed_power_map != null ? Number(r.installed_power_map) : r.design_capacity != null ? Number(r.design_capacity) : null,
    address: r.ps_location || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.connect_state === 1 ? "normal" : "offline",
    metadata: r,
  }));
}

async function sungrowMetrics(token: string, appKey: string, psId: string): Promise<DailyMetrics> {
  try {
    const res = await fetch("https://gateway.isolarcloud.com/v1/powerStationService/getPsDetail", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appkey: appKey, token, ps_id: psId }),
    });
    const json = await res.json();
    const d = json.result_data || {};
    return {
      power_kw: d.curr_power != null ? Number(d.curr_power) : null,
      energy_kwh: d.today_energy != null ? Number(d.today_energy) : null,
      total_energy_kwh: d.total_energy != null ? Number(d.total_energy) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Huawei FusionSolar
// ═══════════════════════════════════════════════════════════

async function huaweiListPlants(xsrfToken: string, cookies: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://eu5.fusionsolar.huawei.com/thirdData/getStationList", {
    method: "POST", headers: { "Content-Type": "application/json", "XSRF-TOKEN": xsrfToken, Cookie: cookies },
    body: JSON.stringify({ pageNo: 1, pageSize: 100 }),
  });
  const json = await res.json();
  const list = (json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.stationCode || ""), name: String(r.stationName || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.stationAddr || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.realHealthState === 3 ? "normal" : r.realHealthState === 1 ? "offline" : r.realHealthState === 2 ? "alarm" : "unknown",
    metadata: r,
  }));
}

async function huaweiMetrics(xsrfToken: string, cookies: string, stationCode: string): Promise<DailyMetrics> {
  try {
    const res = await fetch("https://eu5.fusionsolar.huawei.com/thirdData/getStationRealKpi", {
      method: "POST", headers: { "Content-Type": "application/json", "XSRF-TOKEN": xsrfToken, Cookie: cookies },
      body: JSON.stringify({ stationCodes: stationCode }),
    });
    const json = await res.json();
    const d = json.data?.[0]?.dataItemMap || {};
    return {
      power_kw: d.real_health_state != null ? null : d.day_power != null ? Number(d.day_power) : null,
      energy_kwh: d.day_power != null ? Number(d.day_power) : null,
      total_energy_kwh: d.total_power != null ? Number(d.total_power) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// GoodWe SEMS
// ═══════════════════════════════════════════════════════════

async function goodweListPlants(token: string, api: string): Promise<NormalizedPlant[]> {
  const baseApi = api || "https://semsportal.com";
  const res = await fetch(`${baseApi}/api/v2/PowerStation/GetPowerStationByUser`, {
    method: "POST", headers: { "Content-Type": "application/json", Token: `{"version":"v2.1.0","client":"ios","language":"en","timestamp":"${Date.now()}","uid":"","token":"${token}"}` },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  const list = (json.data?.list || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.powerstation_id || r.id || ""), name: String(r.stationname || r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === 1 || r.status === "1" ? "normal" : r.status === 0 ? "offline" : "unknown",
    metadata: r,
  }));
}

async function goodweMetrics(token: string, api: string, psId: string): Promise<DailyMetrics> {
  try {
    const baseApi = api || "https://semsportal.com";
    const res = await fetch(`${baseApi}/api/v2/PowerStation/GetPowerStationInfo`, {
      method: "POST", headers: { "Content-Type": "application/json", Token: `{"version":"v2.1.0","client":"ios","language":"en","timestamp":"${Date.now()}","uid":"","token":"${token}"}` },
      body: JSON.stringify({ powerStationId: psId }),
    });
    const json = await res.json();
    const d = json.data?.kpi || {};
    return {
      power_kw: d.pac != null ? Number(d.pac) / 1000 : null,
      energy_kwh: d.power != null ? Number(d.power) : null,
      total_energy_kwh: d.total_power != null ? Number(d.total_power) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Fronius Solar.web
// ═══════════════════════════════════════════════════════════

async function froniusListPlants(apiKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch(`https://api.solarweb.com/swqapi/pvsystems?accessKeyId=${encodeURIComponent(apiKey)}`, { headers: { AccessKeyId: apiKey } });
  if (!res.ok) throw new Error(`Fronius ${res.status}`);
  const json = await res.json();
  const list = (json.pvSystems || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.pvSystemId || r.id || ""), name: String(r.name || ""),
    capacity_kw: r.peakPower != null ? Number(r.peakPower) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: "normal", metadata: r,
  }));
}

async function froniusMetrics(apiKey: string, pvSystemId: string): Promise<DailyMetrics> {
  try {
    const res = await fetch(`https://api.solarweb.com/swqapi/pvsystems/${pvSystemId}/flowdata?accessKeyId=${encodeURIComponent(apiKey)}`, { headers: { AccessKeyId: apiKey } });
    if (!res.ok) return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
    const json = await res.json();
    const d = json.data || {};
    return {
      power_kw: d.P_PV != null ? Number(d.P_PV) / 1000 : null,
      energy_kwh: d.E_Day != null ? Number(d.E_Day) / 1000 : null,
      total_energy_kwh: d.E_Total != null ? Number(d.E_Total) / 1000 : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// Fox ESS
// ═══════════════════════════════════════════════════════════

async function foxessListPlants(apiKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://www.foxesscloud.com/op/v0/plant/list", {
    method: "POST", headers: { "Content-Type": "application/json", token: apiKey },
    body: JSON.stringify({ currentPage: 1, pageSize: 100 }),
  });
  const json = await res.json();
  const list = (json.result?.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.stationID || r.id || ""), name: String(r.stationName || r.name || ""),
    capacity_kw: r.installedCapacity != null ? Number(r.installedCapacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === 1 ? "normal" : "offline", metadata: r,
  }));
}

async function foxessMetrics(apiKey: string, stationId: string): Promise<DailyMetrics> {
  try {
    const res = await fetch("https://www.foxesscloud.com/op/v0/plant/real/query", {
      method: "POST", headers: { "Content-Type": "application/json", token: apiKey },
      body: JSON.stringify({ stationID: stationId }),
    });
    const json = await res.json();
    const d = json.result || {};
    return {
      power_kw: d.currentPower != null ? Number(d.currentPower) : null,
      energy_kwh: d.todayGeneration != null ? Number(d.todayGeneration) : null,
      total_energy_kwh: d.cumulativeGeneration != null ? Number(d.cumulativeGeneration) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// SolaX Cloud
// ═══════════════════════════════════════════════════════════

async function solaxListPlants(apiKey: string): Promise<NormalizedPlant[]> {
  // SolaX uses inverter SN-based queries; list via getUserSiteList
  const res = await fetch(`https://www.solaxcloud.com/proxyApp/proxy/api/getMpptSiteLists.do?tokenId=${encodeURIComponent(apiKey)}`);
  const json = await res.json();
  const list = (json.result || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.siteId || r.id || ""), name: String(r.siteName || r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: "normal", metadata: r,
  }));
}

async function solaxMetrics(apiKey: string, siteId: string): Promise<DailyMetrics> {
  try {
    const res = await fetch(`https://www.solaxcloud.com/proxyApp/proxy/api/getRealtimeInfo.do?tokenId=${encodeURIComponent(apiKey)}&sn=${siteId}`);
    const json = await res.json();
    const d = json.result || {};
    return {
      power_kw: d.acpower != null ? Number(d.acpower) / 1000 : null,
      energy_kwh: d.yieldtoday != null ? Number(d.yieldtoday) : null,
      total_energy_kwh: d.yieldtotal != null ? Number(d.yieldtotal) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// SAJ eSolar
// ═══════════════════════════════════════════════════════════

async function sajListPlants(cookies: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://fop.saj-electric.com/saj/monitor/site/getUserPlantList", { headers: { Cookie: cookies } });
  const json = await res.json();
  const list = (json.plantList || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.plantuid || r.id || ""), name: String(r.plantname || r.name || ""),
    capacity_kw: r.peakpower != null ? Number(r.peakpower) : null,
    address: r.address || null,
    latitude: r.lat != null ? Number(r.lat) : null, longitude: r.lng != null ? Number(r.lng) : null,
    status: r.isOnline === true || r.isOnline === 1 ? "normal" : "offline", metadata: r,
  }));
}

async function sajMetrics(cookies: string, plantUid: string): Promise<DailyMetrics> {
  try {
    const res = await fetch(`https://fop.saj-electric.com/saj/monitor/site/getPlantDetailInfo?plantuid=${plantUid}`, { headers: { Cookie: cookies } });
    const json = await res.json();
    const d = json.plantDetail || {};
    return {
      power_kw: d.nowPower != null ? Number(d.nowPower) : null,
      energy_kwh: d.todayElectricity != null ? Number(d.todayElectricity) : null,
      total_energy_kwh: d.totalElectricity != null ? Number(d.totalElectricity) : null,
      metadata: d,
    };
  } catch { return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
}

// ═══════════════════════════════════════════════════════════
// ShineMonitor
// ═══════════════════════════════════════════════════════════

async function shinemonitorListPlants(secret: string, token: string): Promise<NormalizedPlant[]> {
  const res = await fetch(`https://web.shinemonitor.com/public/?sign=${secret}&salt=${token}&token=${token}&action=queryPlants&source=1&lang=1`, {
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  const list = (json.dat || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.pn || r.id || ""), name: String(r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: null, latitude: null, longitude: null,
    status: r.status === 1 ? "normal" : "offline", metadata: r,
  }));
}

// ═══════════════════════════════════════════════════════════
// Enphase Enlighten
// ═══════════════════════════════════════════════════════════

async function enphaseListPlants(apiKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch(`https://api.enphaseenergy.com/api/v4/systems?key=${encodeURIComponent(apiKey)}&size=100`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = (json.systems || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.system_id || ""), name: String(r.system_name || ""),
    capacity_kw: r.system_size != null ? Number(r.system_size) / 1000 : null,
    address: r.city || null,
    latitude: null, longitude: null,
    status: r.status === "normal" ? "normal" : "offline", metadata: r,
  }));
}

// ═══════════════════════════════════════════════════════════
// KSTAR
// ═══════════════════════════════════════════════════════════

async function kstarListPlants(token: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://cloud.kstar.com/api/plants?page=1&pageSize=100", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = (json.data?.list || json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.plantId || r.id || ""), name: String(r.plantName || r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === 1 ? "normal" : "offline", metadata: r,
  }));
}

// ═══════════════════════════════════════════════════════════
// Intelbras Solar
// ═══════════════════════════════════════════════════════════

async function intelbrasListPlants(token: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://solar.intelbras.com/api/plants?page=1&size=100", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = (json.data?.plants || json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.id || ""), name: String(r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: r.status === "online" ? "normal" : "offline", metadata: r,
  }));
}

// ═══════════════════════════════════════════════════════════
// EcoSolys
// ═══════════════════════════════════════════════════════════

async function ecosolysListPlants(token: string): Promise<NormalizedPlant[]> {
  const res = await fetch("https://portal.ecosolys.com.br/api/plants", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = (json.plants || json.data || []) as any[];
  return list.map((r: any) => ({
    external_id: String(r.id || ""), name: String(r.name || ""),
    capacity_kw: r.capacity != null ? Number(r.capacity) : null,
    address: r.address || null,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
    status: "normal", metadata: r,
  }));
}

// ═══════════════════════════════════════════════════════════
// Generic sync orchestrator
// ═══════════════════════════════════════════════════════════

interface SyncContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string; userId: string; provider: string; integrationId: string;
}

async function upsertPlants(ctx: SyncContext, plants: NormalizedPlant[]): Promise<{ count: number; errors: string[] }> {
  let count = 0; const errors: string[] = [];
  for (const plant of plants) {
    const { error } = await ctx.supabaseAdmin.from("solar_plants").upsert({
      tenant_id: ctx.tenantId, integration_id: ctx.integrationId, provider: ctx.provider,
      external_id: plant.external_id, name: plant.name, capacity_kw: plant.capacity_kw,
      address: plant.address, latitude: plant.latitude, longitude: plant.longitude,
      status: plant.status, metadata: plant.metadata, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider,external_id" });
    if (error) errors.push(`Plant ${plant.external_id}: ${error.message}`); else count++;
  }
  return { count, errors };
}

async function upsertMetrics(ctx: SyncContext, plantId: string, metrics: DailyMetrics): Promise<string | null> {
  const { error } = await ctx.supabaseAdmin.from("solar_plant_metrics_daily").upsert({
    tenant_id: ctx.tenantId, plant_id: plantId, date: today(),
    energy_kwh: metrics.energy_kwh, power_kw: metrics.power_kw,
    total_energy_kwh: metrics.total_energy_kwh, metadata: metrics.metadata,
  }, { onConflict: "tenant_id,plant_id,date" });
  return error ? error.message : null;
}

async function syncPlantsByProvider(
  ctx: SyncContext,
  listFn: () => Promise<NormalizedPlant[]>,
  metricsFn: ((extId: string) => Promise<DailyMetrics>) | null,
  mode: string,
  selectedPlantIds?: string[] | null,
) {
  let plantsUpserted = 0, metricsUpserted = 0;
  const errors: string[] = [];

  // "discover" mode: return plants without saving
  if (mode === "discover") {
    try {
      const plants = await listFn();
      return { plantsUpserted: 0, metricsUpserted: 0, errors: [], discoveredPlants: plants };
    } catch (err) {
      errors.push(`listPlants: ${(err as Error).message}`);
      return { plantsUpserted: 0, metricsUpserted: 0, errors, discoveredPlants: [] };
    }
  }

  if (mode === "plants" || mode === "full") {
    try {
      let plants = await listFn();
      // If selectedPlantIds provided, only upsert those
      if (selectedPlantIds && selectedPlantIds.length > 0) {
        plants = plants.filter((p) => selectedPlantIds.includes(p.external_id));
      }
      const result = await upsertPlants(ctx, plants);
      plantsUpserted = result.count;
      errors.push(...result.errors);
    } catch (err) { errors.push(`listPlants: ${(err as Error).message}`); }
  }

  if ((mode === "metrics" || mode === "full") && metricsFn) {
    const { data: dbPlants } = await ctx.supabaseAdmin.from("solar_plants").select("id, external_id").eq("tenant_id", ctx.tenantId).eq("integration_id", ctx.integrationId);
    for (const p of dbPlants || []) {
      const metrics = await metricsFn(p.external_id);
      const err = await upsertMetrics(ctx, p.id, metrics);
      if (err) errors.push(`Metrics ${p.external_id}: ${err}`); else metricsUpserted++;
    }
  }

  return { plantsUpserted, metricsUpserted, errors };
}

// ═══════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("user_id", userId).single();
    if (!profile?.tenant_id) return jsonResponse({ error: "Tenant not found" }, 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const provider = body.provider || "solarman_business_api";
    const mode = body.mode || "full"; // "full" | "plants" | "metrics" | "discover"
    const selectedPlantIds: string[] | null = body.selected_plant_ids || null;

    // Legacy ID normalization
    const LEGACY_MAP: Record<string, string> = { solarman_business_api: "solarman_business" };
    const normalizedProvider = LEGACY_MAP[provider] || provider;

    const { data: integration, error: intErr } = await supabaseAdmin
      .from("monitoring_integrations").select("id, tokens, credentials, status")
      .eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();

    // Also try normalized ID
    let int = integration;
    if (!int && normalizedProvider !== provider) {
      const { data: int2 } = await supabaseAdmin
        .from("monitoring_integrations").select("id, tokens, credentials, status")
        .eq("tenant_id", tenantId).eq("provider", normalizedProvider).maybeSingle();
      int = int2;
    }

    if (!int) return jsonResponse({ error: "Integration not found. Connect first." }, 404);

    const tokens = (int.tokens || {}) as Record<string, any>;
    const credentials = (int.credentials || {}) as Record<string, any>;
    const ctx: SyncContext = { supabaseAdmin, tenantId, userId, provider: int.id ? provider : normalizedProvider, integrationId: int.id };

    // ── Token expiration check (for token-based providers) ──
    if (tokens.expires_at) {
      const expiresAt = new Date(tokens.expires_at);
      if (expiresAt < new Date()) {
        await supabaseAdmin.from("monitoring_integrations").update({ status: "error", sync_error: "Token expired. Reconnect.", updated_at: new Date().toISOString() }).eq("id", int.id);
        return jsonResponse({ error: "Token expired. Please reconnect." }, 401);
      }
    }

    let result: { plantsUpserted: number; metricsUpserted: number; errors: string[]; discoveredPlants?: NormalizedPlant[] };

    // ═══ Provider dispatch ═══
    const p = normalizedProvider;

    if (p === "solarman_business" || provider === "solarman_business_api") {
      const at = tokens.access_token as string;
      if (!at) return jsonResponse({ error: "No access token. Reconnect." }, 400);
      result = await syncPlantsByProvider(ctx, () => solarmanListPlants(at), (eid) => solarmanMetrics(at, eid), mode, selectedPlantIds);
    } else if (p === "solaredge") {
      const ak = credentials.apiKey as string;
      if (!ak) return jsonResponse({ error: "No API key." }, 400);
      result = await syncPlantsByProvider(ctx, () => solaredgeListSites(ak), (eid) => solaredgeMetrics(ak, eid), mode, selectedPlantIds);
    } else if (p === "solis_cloud") {
      const { apiId } = credentials; const apiSecret = tokens.apiSecret as string;
      if (!apiId || !apiSecret) return jsonResponse({ error: "Missing credentials." }, 400);
      result = await syncPlantsByProvider(ctx, () => solisListPlants(apiId, apiSecret), (eid) => solisMetrics(apiId, apiSecret, eid), mode, selectedPlantIds);
    } else if (p === "deye_cloud") {
      const at = tokens.access_token as string;
      const baseUrl = (credentials.baseUrl as string) || "https://eu1-developer.deyecloud.com/v1.0";
      if (!at) return jsonResponse({ error: "No access token." }, 400);
      result = await syncPlantsByProvider(ctx, () => deyeListPlants(baseUrl, at), (eid) => deyeMetrics(baseUrl, at, eid), mode, selectedPlantIds);
    } else if (p === "growatt") {
      const authMode = credentials.auth_mode as string || (tokens.apiKey ? "api_key" : "portal");
      if (authMode === "api_key") {
        const apiKey = tokens.apiKey as string || "";
        if (!apiKey) return jsonResponse({ error: "No API key (token) stored for Growatt." }, 400);
        result = await syncPlantsByProvider(ctx, () => growattApiListPlants(apiKey), (eid) => growattApiMetrics(apiKey, eid), mode, selectedPlantIds);
      } else {
        const cookies = tokens.cookies as string || "";
        result = await syncPlantsByProvider(ctx, () => growattListPlants(cookies), (eid) => growattMetrics(cookies, eid), mode, selectedPlantIds);
      }
    } else if (p === "hoymiles") {
      const token = tokens.token as string || "";
      result = await syncPlantsByProvider(ctx, () => hoymilesListPlants(token), (eid) => hoymilesMetrics(token, eid), mode, selectedPlantIds);
    } else if (p === "sungrow") {
      const token = tokens.token as string || "";
      const appKey = credentials.appKey as string || credentials.appId as string || "";
      result = await syncPlantsByProvider(ctx, () => sungrowListPlants(token, appKey), (eid) => sungrowMetrics(token, appKey, eid), mode, selectedPlantIds);
    } else if (p === "huawei") {
      const xsrf = tokens.xsrfToken as string || "";
      const cookies = tokens.cookies as string || "";
      result = await syncPlantsByProvider(ctx, () => huaweiListPlants(xsrf, cookies), (eid) => huaweiMetrics(xsrf, cookies, eid), mode, selectedPlantIds);
    } else if (p === "goodwe") {
      const token = tokens.token as string || "";
      const api = tokens.api as string || "https://semsportal.com";
      result = await syncPlantsByProvider(ctx, () => goodweListPlants(token, api), (eid) => goodweMetrics(token, api, eid), mode, selectedPlantIds);
    } else if (p === "fronius") {
      const ak = credentials.apiKey as string || "";
      result = await syncPlantsByProvider(ctx, () => froniusListPlants(ak), (eid) => froniusMetrics(ak, eid), mode, selectedPlantIds);
    } else if (p === "fox_ess") {
      const ak = credentials.apiKey as string || "";
      result = await syncPlantsByProvider(ctx, () => foxessListPlants(ak), (eid) => foxessMetrics(ak, eid), mode, selectedPlantIds);
    } else if (p === "solax") {
      const ak = credentials.apiKey as string || "";
      result = await syncPlantsByProvider(ctx, () => solaxListPlants(ak), (eid) => solaxMetrics(ak, eid), mode, selectedPlantIds);
    } else if (p === "saj") {
      const cookies = tokens.cookies as string || "";
      result = await syncPlantsByProvider(ctx, () => sajListPlants(cookies), (eid) => sajMetrics(cookies, eid), mode, selectedPlantIds);
    } else if (p === "shinemonitor") {
      const secret = tokens.secret as string || "";
      const token = tokens.token as string || "";
      result = await syncPlantsByProvider(ctx, () => shinemonitorListPlants(secret, token), null, mode, selectedPlantIds);
    } else if (p === "enphase") {
      const ak = credentials.apiKey as string || "";
      result = await syncPlantsByProvider(ctx, () => enphaseListPlants(ak), null, mode, selectedPlantIds);
    } else if (p === "kstar") {
      const token = tokens.token as string || "";
      result = await syncPlantsByProvider(ctx, () => kstarListPlants(token), null, mode, selectedPlantIds);
    } else if (p === "intelbras") {
      const token = tokens.token as string || "";
      result = await syncPlantsByProvider(ctx, () => intelbrasListPlants(token), null, mode, selectedPlantIds);
    } else if (p === "ecosolys") {
      const token = tokens.token as string || "";
      result = await syncPlantsByProvider(ctx, () => ecosolysListPlants(token), null, mode, selectedPlantIds);
    } else if (p === "sofar") {
      const at = tokens.access_token as string || "";
      if (!at) return jsonResponse({ error: "No access token." }, 400);
      result = await syncPlantsByProvider(ctx, () => solarmanListPlants(at), (eid) => solarmanMetrics(at, eid), mode, selectedPlantIds);
    } else if (p === "apsystems") {
      result = { plantsUpserted: 0, metricsUpserted: 0, errors: ["APsystems sync requires session refresh. Use portal credentials."] };
    } else {
      return jsonResponse({ error: `Provider sync not implemented yet: ${provider}. Connect via portal.` }, 501);
    }

    // Discover mode: return plant list without saving
    if (mode === "discover") {
      return jsonResponse({
        success: true,
        plants: (result.discoveredPlants || []).map((p) => ({
          external_id: p.external_id, name: p.name, capacity_kw: p.capacity_kw,
          address: p.address, status: p.status,
        })),
        errors: result.errors,
      });
    }

    // Update integration status
    const newStatus = result.errors.length > 0 ? "error" : "connected";
    await supabaseAdmin.from("monitoring_integrations").update({
      last_sync_at: new Date().toISOString(), status: newStatus,
      sync_error: result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", int.id);

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId, user_id: userId, acao: "monitoring.sync.run",
      tabela: "monitoring_integrations", registro_id: int.id,
      dados_novos: { provider, mode, plantsUpserted: result.plantsUpserted, metricsUpserted: result.metricsUpserted, errors: result.errors.length },
    });

    return jsonResponse({ success: true, plants_synced: result.plantsUpserted, metrics_synced: result.metricsUpserted, errors: result.errors });
  } catch (err) {
    console.error("monitoring-sync error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
