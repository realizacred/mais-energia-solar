import { useQuery } from "@tanstack/react-query";
import { listPlantsWithHealth, listAllReadings } from "@/services/monitoring/monitorService";
import { getFinancials, getPerformanceRatios } from "@/services/monitoring/monitorFinancialService";

export function useMonitorReportsData(range: { start: string; end: string }) {
  const { data: plants = [], isLoading: loadingPlants } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
    staleTime: 2 * 60 * 1000,
  });

  const { data: readings = [], isLoading: loadingReadings } = useQuery({
    queryKey: ["monitor-readings-report", range.start, range.end],
    queryFn: () => listAllReadings(range.start, range.end),
    staleTime: 5 * 60 * 1000,
  });

  const { data: financials } = useQuery({
    queryKey: ["monitor-financials-report", readings.length],
    queryFn: () => {
      const totalKwh = readings.reduce((s, r) => s + r.energy_kwh, 0);
      return getFinancials(0, totalKwh);
    },
    enabled: readings.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: prData = [] } = useQuery({
    queryKey: ["monitor-pr-report", plants.length, readings.length],
    queryFn: () =>
      getPerformanceRatios(
        plants.map((p) => ({
          id: p.id,
          name: p.name,
          installed_power_kwp: p.installed_power_kwp,
          latitude: p.lat ?? null,
          longitude: p.lng ?? null,
        })),
        readings
      ),
    enabled: plants.length > 0 && readings.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    plants,
    readings,
    financials,
    prData,
    isLoading: loadingPlants || loadingReadings,
  };
}
