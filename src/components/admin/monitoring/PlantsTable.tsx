import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatKwh, formatEnergyAutoScale, formatNumber } from "@/lib/formatters/index";
import type { SolarPlant, SolarPlantMetricsDaily } from "@/services/monitoring/types";

const STATUS_LABELS: Record<string, string> = {
  normal: "Normal",
  offline: "Offline",
  alarm: "Alarme",
  no_communication: "Sem comunicação",
  unknown: "Desconhecido",
};

interface Props {
  plants: SolarPlant[];
  metrics: SolarPlantMetricsDaily[];
}

export function PlantsTable({ plants, metrics }: Props) {
  const metricsMap = new Map(metrics.map((m) => [m.plant_id, m]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Potência (kW)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Produção Hoje</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Endereço</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plants.map((plant) => {
          const m = metricsMap.get(plant.id);
          return (
            <TableRow key={plant.id}>
              <TableCell className="font-medium">{plant.name || "—"}</TableCell>
              <TableCell>{plant.capacity_kw != null ? formatNumber(plant.capacity_kw, 1) : "—"}</TableCell>
              <TableCell>
                <StatusBadge
                  status={STATUS_LABELS[plant.status] || "Desconhecido"}
                  size="sm"
                />
              </TableCell>
              <TableCell>
                {m?.energy_kwh != null ? formatKwh(Number(m.energy_kwh)) : "—"}
              </TableCell>
              <TableCell>
                {m?.total_energy_kwh != null
                  ? formatEnergyAutoScale(Number(m.total_energy_kwh))
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                {plant.address || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
