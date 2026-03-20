/**
 * useGenerationReport — hook for plant generation report data (monthly aggregation + daily readings).
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { listDailyReadings, getPlantDetail } from "@/services/monitoring/monitorService";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MonthlyReportRow {
  month: string; // "2026-03"
  label: string; // "MAR./2026"
  generation_kwh: number;
  prognosis_kwh: number;
  performance_pct: number;
  days_in_month: number;
}

export interface GenerationReportData {
  plantName: string;
  capacityKwp: number;
  totalGeneration: number;
  totalPrognosis: number;
  overallPerformance: number;
  monthlyData: MonthlyReportRow[];
  dailyReadings: Array<{ date: string; label: string; kwh: number }>;
  selectedMonth: string;
}

const STALE_TIME = 1000 * 60 * 5;

/**
 * Fetches generation data for a plant, aggregated by month for the last 12 months,
 * plus daily detail for a selected month.
 */
export function useGenerationReport(plantId: string | null, selectedMonth?: string) {
  // Plant detail
  const { data: plant } = useQuery({
    queryKey: ["generation-report-plant", plantId],
    queryFn: () => getPlantDetail(plantId!),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });

  // Determine date ranges
  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");
  const activeMonth = selectedMonth || currentMonth;

  // 12 months of data for the monthly summary table
  const yearStart = format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd");
  const yearEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: yearReadings = [], isLoading: loadingYear } = useQuery({
    queryKey: ["generation-report-year", plantId, yearStart, yearEnd],
    queryFn: () => listDailyReadings(plantId!, yearStart, yearEnd),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });

  // Daily readings for the selected month
  const monthStart = `${activeMonth}-01`;
  const monthEndDate = endOfMonth(parseISO(monthStart));
  const monthEnd = format(monthEndDate, "yyyy-MM-dd");

  const { data: monthReadings = [], isLoading: loadingMonth } = useQuery({
    queryKey: ["generation-report-month", plantId, activeMonth],
    queryFn: () => listDailyReadings(plantId!, monthStart, monthEnd),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });

  // Aggregate monthly data
  const capacityKwp = plant?.installed_power_kwp || 0;

  // Simple prognosis: capacity * avg HSP (4.5) * days — can be improved with actual HSP data later
  const AVG_HSP = 4.5;

  const monthlyMap = new Map<string, number>();
  yearReadings.forEach((r) => {
    const m = r.date.substring(0, 7);
    monthlyMap.set(m, (monthlyMap.get(m) || 0) + (r.energy_kwh || 0));
  });

  const monthlyData: MonthlyReportRow[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(d, "yyyy-MM");
    const label = format(d, "MMM./yyyy", { locale: ptBR }).toUpperCase();
    const gen = monthlyMap.get(key) || 0;
    const daysInMonth = getDaysInMonth(d);
    const prognosis = capacityKwp * AVG_HSP * daysInMonth;
    const perf = prognosis > 0 ? (gen / prognosis) * 100 : 0;
    monthlyData.push({
      month: key,
      label,
      generation_kwh: Math.round(gen * 100) / 100,
      prognosis_kwh: Math.round(prognosis * 100) / 100,
      performance_pct: Math.round(perf * 100) / 100,
      days_in_month: daysInMonth,
    });
  }

  const totalGeneration = monthlyData.reduce((s, m) => s + m.generation_kwh, 0);
  const totalPrognosis = monthlyData.reduce((s, m) => s + m.prognosis_kwh, 0);
  const overallPerformance = totalPrognosis > 0 ? (totalGeneration / totalPrognosis) * 100 : 0;

  const dailyReadings = monthReadings
    .map((r) => ({
      date: r.date,
      label: format(parseISO(r.date), "dd/MM"),
      kwh: Number((r.energy_kwh || 0).toFixed(1)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const reportData: GenerationReportData | null = plant
    ? {
        plantName: plant.name || "Usina",
        capacityKwp,
        totalGeneration: Math.round(totalGeneration * 100) / 100,
        totalPrognosis: Math.round(totalPrognosis * 100) / 100,
        overallPerformance: Math.round(overallPerformance * 100) / 100,
        monthlyData,
        dailyReadings,
        selectedMonth: activeMonth,
      }
    : null;

  return {
    data: reportData,
    isLoading: loadingYear || loadingMonth,
    plant,
  };
}
