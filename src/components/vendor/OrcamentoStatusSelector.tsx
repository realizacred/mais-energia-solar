import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
}

interface OrcamentoStatusSelectorProps {
  orcamentoId: string;
  currentStatusId: string | null;
  statuses: LeadStatus[];
  onStatusChange: (newStatusId: string | null) => void;
  isUpdating?: boolean;
}

export function OrcamentoStatusSelector({
  orcamentoId,
  currentStatusId,
  statuses,
  onStatusChange,
  isUpdating = false,
}: OrcamentoStatusSelectorProps) {
  const handleStatusChange = (value: string) => {
    const newStatusId = value === "novo" ? null : value;
    onStatusChange(newStatusId);
  };

  const currentStatus = statuses.find((s) => s.id === currentStatusId);

  return (
    <div className="relative">
      <Select
        value={currentStatusId || "novo"}
        onValueChange={handleStatusChange}
        disabled={isUpdating}
      >
        <SelectTrigger
          className="w-[140px] h-8 text-xs"
          style={{
            borderColor: currentStatus?.cor || "hsl(var(--primary))",
            color: currentStatus?.cor || "hsl(var(--primary))",
          }}
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SelectValue placeholder="Status" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="novo">
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-primary"
              />
              Novo
            </span>
          </SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: status.cor }}
                />
                {status.nome}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
