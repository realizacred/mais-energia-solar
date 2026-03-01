/**
 * Mock seed service — populates monitor_* tables with demo data.
 * Only for development/demo purposes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { MonitorPlantStatus, AlertSeverity, AlertType } from "./monitorTypes";

const CITIES = [
  { name: "São Paulo", state: "SP", lat: -23.55, lng: -46.63 },
  { name: "Rio de Janeiro", state: "RJ", lat: -22.91, lng: -43.17 },
  { name: "Belo Horizonte", state: "MG", lat: -19.92, lng: -43.94 },
  { name: "Curitiba", state: "PR", lat: -25.43, lng: -49.27 },
  { name: "Brasília", state: "DF", lat: -15.79, lng: -47.88 },
  { name: "Salvador", state: "BA", lat: -12.97, lng: -38.51 },
  { name: "Fortaleza", state: "CE", lat: -3.72, lng: -38.53 },
  { name: "Recife", state: "PE", lat: -8.05, lng: -34.87 },
  { name: "Porto Alegre", state: "RS", lat: -30.03, lng: -51.23 },
  { name: "Goiânia", state: "GO", lat: -16.68, lng: -49.26 },
  { name: "Manaus", state: "AM", lat: -3.12, lng: -60.02 },
  { name: "Belém", state: "PA", lat: -1.46, lng: -48.50 },
  { name: "Campinas", state: "SP", lat: -22.91, lng: -47.06 },
  { name: "Uberlândia", state: "MG", lat: -18.92, lng: -48.28 },
  { name: "Campo Grande", state: "MS", lat: -20.44, lng: -54.65 },
  { name: "Natal", state: "RN", lat: -5.79, lng: -35.21 },
  { name: "Florianópolis", state: "SC", lat: -27.60, lng: -48.55 },
  { name: "Vitória", state: "ES", lat: -20.32, lng: -40.34 },
  { name: "Maceió", state: "AL", lat: -9.67, lng: -35.74 },
  { name: "João Pessoa", state: "PB", lat: -7.12, lng: -34.86 },
];

const STATUSES: MonitorPlantStatus[] = ["online", "online", "online", "online", "alert", "offline", "unknown"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function seedMonitorData(): Promise<{ plants: number; readings: number; events: number }> {
  // Get current user to determine tenant
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles" as any)
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Perfil não encontrado");
  const tenantId = (profile as any).tenant_id;

  // 1) Create 20 plants
  const plantInserts = CITIES.map((city, i) => ({
    tenant_id: tenantId,
    name: `Usina ${city.name} ${i + 1}`,
    lat: city.lat + rand(-0.1, 0.1),
    lng: city.lng + rand(-0.1, 0.1),
    city: city.name,
    state: city.state,
    installed_power_kwp: Number(rand(5, 500).toFixed(1)),
    provider_id: pickRandom(["solarman_business_api", "solaredge", "solis_cloud", "deye_cloud"]),
    provider_plant_id: `MOCK-${i + 1}`,
    is_active: true,
  }));

  const { data: plants, error: plantErr } = await supabase
    .from("monitor_plants" as any)
    .insert(plantInserts as any)
    .select("id, installed_power_kwp");

  if (plantErr) throw new Error(`Erro ao criar usinas: ${plantErr.message}`);
  const insertedPlants = (plants as any[]) || [];

  // 2) Create health cache for each plant
  const healthInserts = insertedPlants.map((p) => {
    const status = pickRandom(STATUSES);
    const hoursAgo = status === "online" ? rand(0, 0.5) : status === "offline" ? rand(3, 48) : rand(0.5, 3);
    const lastSeen = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    const energyToday = status === "offline" ? 0 : Number(rand(1, (p.installed_power_kwp || 10) * 4).toFixed(1));
    const energyMonth = Number((energyToday * rand(15, 28)).toFixed(1));

    return {
      tenant_id: tenantId,
      plant_id: p.id,
      status,
      last_seen_at: lastSeen,
      energy_today_kwh: energyToday,
      energy_month_kwh: energyMonth,
      performance_7d_pct: status === "unknown" ? null : Number(rand(60, 100).toFixed(1)),
      open_alerts_count: status === "alert" ? randInt(1, 5) : 0,
    };
  });

  await supabase.from("monitor_health_cache" as any).insert(healthInserts as any);

  // 3) Create 30 days of readings for first 5 plants
  const readingInserts: any[] = [];
  const today = new Date();
  for (let i = 0; i < Math.min(5, insertedPlants.length); i++) {
    const plant = insertedPlants[i];
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      readingInserts.push({
        tenant_id: tenantId,
        plant_id: plant.id,
        date: date.toISOString().slice(0, 10),
        energy_kwh: Number(rand(5, (plant.installed_power_kwp || 10) * 4.5).toFixed(1)),
        peak_power_kw: Number(rand(1, (plant.installed_power_kwp || 10) * 0.9).toFixed(1)),
      });
    }
  }

  if (readingInserts.length > 0) {
    await supabase.from("monitor_readings_daily" as any).insert(readingInserts as any);
  }

  // 4) Create events for plants with alerts
  const eventInserts: any[] = [];
  const alertTypes: AlertType[] = ["offline", "low_generation", "comm_fault", "inverter_fault"];
  const severities: AlertSeverity[] = ["warn", "critical"];

  insertedPlants.forEach((p, idx) => {
    const status = healthInserts[idx]?.status;
    if (status === "alert" || status === "offline") {
      const count = randInt(1, 4);
      for (let e = 0; e < count; e++) {
        const hoursAgo = rand(0.5, 72);
        eventInserts.push({
          tenant_id: tenantId,
          plant_id: p.id,
          severity: pickRandom(severities),
          type: pickRandom(alertTypes),
          title: pickRandom([
            "Inversor sem comunicação",
            "Geração abaixo do esperado",
            "Falha de comunicação",
            "Tensão de rede fora do limite",
            "Usina offline",
          ]),
          message: "Evento detectado automaticamente pelo sistema de monitoramento.",
          starts_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
          is_open: Math.random() > 0.3,
        });
      }
    }
  });

  if (eventInserts.length > 0) {
    await supabase.from("monitor_events" as any).insert(eventInserts as any);
  }

  return {
    plants: insertedPlants.length,
    readings: readingInserts.length,
    events: eventInserts.length,
  };
}

export async function clearMonitorData(): Promise<void> {
  // Order matters due to FK constraints
  await supabase.from("monitor_readings_daily" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("monitor_events" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("monitor_health_cache" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("monitor_devices" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("monitor_plants" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
