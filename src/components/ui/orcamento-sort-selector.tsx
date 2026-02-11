import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORCAMENTO_SORT_OPTIONS,
  type OrcamentoSortOption,
} from "@/hooks/useOrcamentoSort";

interface OrcamentoSortSelectorProps {
  value: OrcamentoSortOption;
  onChange: (value: OrcamentoSortOption) => void;
}

export function OrcamentoSortSelector({
  value,
  onChange,
}: OrcamentoSortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value} onValueChange={(v) => onChange(v as OrcamentoSortOption)}>
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          {ORCAMENTO_SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
