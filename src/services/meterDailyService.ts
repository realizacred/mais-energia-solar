/**
 * meterDailyService — Service for daily consolidated meter readings.
 * SRP: Query daily summaries (from meter_readings_daily VIEW) for consumption/injection.
 * 
 * The VIEW meter_readings_daily already consolidates raw readings into daily:
 * - consumo_dia_kwh = energy_import delta (last - first reading of day)
 * - injecao_dia_kwh = energy_export delta (last - first reading of day)
 * - readings_count = number of raw readings that day
 * 
 * This service is the SSOT for daily energy data from meters.
 * Raw meter_readings should NOT be used directly for daily reports.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DailyReading {
  id: string;
  meter_device_id: string;
  reading_date: string;
  measured_at: string;
  consumo_dia_kwh: number;
  injecao_dia_kwh: number;
  energy_import_kwh: number;
  energy_export_kwh: number;
  voltage_v: number | null;
  power_w: number | null;
  readings_count: number;
}

export const meterDailyService = {
  /**
   * Get daily readings for a meter. Uses the VIEW which already consolidates.
   * Returns one row per day with consumption and injection deltas.
   */
  async getDailyReadings(meterId: string, limit = 60): Promise<DailyReading[]> {
    const { data, error } = await (supabase as any)
      .from("meter_readings_daily")
      .select("id, meter_device_id, reading_date, measured_at, consumo_dia_kwh, injecao_dia_kwh, energy_import_kwh, energy_export_kwh, voltage_v, power_w, readings_count")
      .eq("meter_device_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as DailyReading[];
  },

  /**
   * Get daily readings for a specific date range.
   */
  async getDailyReadingsRange(
    meterId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyReading[]> {
    const { data, error } = await (supabase as any)
      .from("meter_readings_daily")
      .select("id, meter_device_id, reading_date, measured_at, consumo_dia_kwh, injecao_dia_kwh, energy_import_kwh, energy_export_kwh, voltage_v, power_w, readings_count")
      .eq("meter_device_id", meterId)
      .gte("reading_date", startDate)
      .lte("reading_date", endDate)
      .order("reading_date", { ascending: true });
    if (error) throw error;
    return (data || []) as DailyReading[];
  },

  /**
   * Get monthly summary from daily readings.
   * Aggregates daily deltas for a full month.
   */
  async getMonthlySummary(
    meterId: string,
    year: number,
    month: number
  ): Promise<{ consumo_kwh: number; injecao_kwh: number; days_with_data: number }> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const readings = await this.getDailyReadingsRange(meterId, startDate, endDate);

    const consumo_kwh = readings.reduce((sum, r) => sum + Number(r.consumo_dia_kwh || 0), 0);
    const injecao_kwh = readings.reduce((sum, r) => sum + Number(r.injecao_dia_kwh || 0), 0);

    return {
      consumo_kwh: Math.round(consumo_kwh * 100) / 100,
      injecao_kwh: Math.round(injecao_kwh * 100) / 100,
      days_with_data: readings.length,
    };
  },

  /**
   * Get the latest daily reading (today or most recent).
   */
  async getLatestDaily(meterId: string): Promise<DailyReading | null> {
    const { data, error } = await (supabase as any)
      .from("meter_readings_daily")
      .select("id, meter_device_id, reading_date, measured_at, consumo_dia_kwh, injecao_dia_kwh, energy_import_kwh, energy_export_kwh, voltage_v, power_w, readings_count")
      .eq("meter_device_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as DailyReading | null;
  },
};
