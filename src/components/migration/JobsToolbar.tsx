/**
 * JobsToolbar — Busca + filtros de status/tipo para histórico de jobs.
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface JobsFilter {
  q: string;
  status: string; // "all" | pending | running | completed | failed | rolled_back
  type: string;   // "all" | job_type
}

interface Props {
  filter: JobsFilter;
  onChange: (next: JobsFilter) => void;
  jobTypes: string[];
}

export function JobsToolbar({ filter, onChange, jobTypes }: Props) {
  const clear = () => onChange({ q: "", status: "all", type: "all" });
  const isFiltered = filter.q !== "" || filter.status !== "all" || filter.type !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter.q}
          onChange={(e) => onChange({ ...filter, q: e.target.value })}
          placeholder="Buscar por id ou tipo..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <Select
        value={filter.status}
        onValueChange={(v) => onChange({ ...filter, status: v })}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="running">Em execução</SelectItem>
          <SelectItem value="completed">Concluídos</SelectItem>
          <SelectItem value="failed">Falhos</SelectItem>
          <SelectItem value="rolled_back">Revertidos</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filter.type}
        onValueChange={(v) => onChange({ ...filter, type: v })}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos tipos</SelectItem>
          {jobTypes.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clear}>
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
