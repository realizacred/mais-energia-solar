import { SearchInput } from "@/components/ui-kit/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TemplateSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterTipo: string;
  onFilterTipoChange: (value: string) => void;
}

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos os tipos" },
  { value: "boas_vindas", label: "Boas-vindas" },
  { value: "mudanca_status", label: "Mudança de Status" },
  { value: "inatividade", label: "Inatividade" },
  { value: "agendamento", label: "Agendamento" },
];

export function TemplateSearchBar({ search, onSearchChange, filterTipo, onFilterTipoChange }: TemplateSearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar template..."
        className="max-w-xs"
      />
      <Select value={filterTipo} onValueChange={onFilterTipoChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filtrar por tipo" />
        </SelectTrigger>
        <SelectContent>
          {TIPO_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
