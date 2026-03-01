import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, CloudSun, Sun, CloudSnow, CloudLightning, Wind, Droplets, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeatherData {
  temp: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  clouds: number;
  city: string;
}

interface Props {
  lat: number;
  lng: number;
  className?: string;
}

const WEATHER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "01d": Sun,
  "01n": Sun,
  "02d": CloudSun,
  "02n": CloudSun,
  "03d": Cloud,
  "03n": Cloud,
  "04d": Cloud,
  "04n": Cloud,
  "09d": CloudRain,
  "09n": CloudRain,
  "10d": CloudRain,
  "10n": CloudRain,
  "11d": CloudLightning,
  "11n": CloudLightning,
  "13d": CloudSnow,
  "13n": CloudSnow,
  "50d": Wind,
  "50n": Wind,
};

async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  // Use Open-Meteo (free, no API key needed)
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,weather_code&timezone=America/Sao_Paulo`
  );
  if (!res.ok) throw new Error("Erro ao buscar clima");
  const data = await res.json();
  const current = data.current;
  
  const weatherCode = current.weather_code;
  const { description, iconKey } = getWeatherDescription(weatherCode);

  return {
    temp: Math.round(current.temperature_2m),
    humidity: current.relative_humidity_2m,
    description,
    icon: iconKey,
    wind_speed: current.wind_speed_10m,
    clouds: current.cloud_cover,
    city: "",
  };
}

function getWeatherDescription(code: number): { description: string; iconKey: string } {
  if (code === 0) return { description: "Céu limpo", iconKey: "01d" };
  if (code <= 3) return { description: "Parcialmente nublado", iconKey: "02d" };
  if (code <= 48) return { description: "Nublado/Neblina", iconKey: "03d" };
  if (code <= 57) return { description: "Chuvisco", iconKey: "09d" };
  if (code <= 67) return { description: "Chuva", iconKey: "10d" };
  if (code <= 77) return { description: "Neve", iconKey: "13d" };
  if (code <= 82) return { description: "Pancadas de chuva", iconKey: "09d" };
  if (code <= 86) return { description: "Neve forte", iconKey: "13d" };
  if (code <= 99) return { description: "Tempestade", iconKey: "11d" };
  return { description: "Indisponível", iconKey: "03d" };
}

function getSolarImpact(clouds: number): { label: string; color: string } {
  if (clouds <= 20) return { label: "Excelente para geração", color: "text-success" };
  if (clouds <= 50) return { label: "Boa geração esperada", color: "text-success" };
  if (clouds <= 75) return { label: "Geração reduzida", color: "text-warning" };
  return { label: "Baixa geração esperada", color: "text-destructive" };
}

export function WeatherWidget({ lat, lng, className }: Props) {
  const { data: weather, isLoading } = useQuery({
    queryKey: ["weather", lat, lng],
    queryFn: () => fetchWeather(lat, lng),
    staleTime: 15 * 60 * 1000, // 15 min
    refetchInterval: 30 * 60 * 1000, // 30 min
    enabled: !!lat && !!lng,
  });

  if (isLoading || !weather) {
    return (
      <div className={cn("flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card animate-pulse", className)}>
        <div className="h-12 w-12 rounded-xl bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const WeatherIcon = WEATHER_ICONS[weather.icon] || Cloud;
  const impact = getSolarImpact(weather.clouds);

  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4 space-y-3", className)}>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
          <WeatherIcon className="h-6 w-6 text-info" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{weather.temp}°C</span>
            <span className="text-sm text-muted-foreground capitalize">{weather.description}</span>
          </div>
          <p className={cn("text-xs font-medium", impact.color)}>☀️ {impact.label}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Droplets className="h-3 w-3" /> {weather.humidity}%
        </span>
        <span className="flex items-center gap-1">
          <Wind className="h-3 w-3" /> {weather.wind_speed} km/h
        </span>
        <span className="flex items-center gap-1">
          <Cloud className="h-3 w-3" /> {weather.clouds}% nuvens
        </span>
      </div>
    </div>
  );
}
