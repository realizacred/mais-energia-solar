/**
 * JobsTable — Histórico de jobs com seleção.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JobStatusBadge } from "./JobStatusBadge";
import type { MigrationJobRow } from "@/hooks/useMigrationJobs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  jobs: MigrationJobRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function JobsTable({ jobs, selectedId, onSelect }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card/50 p-8 text-center space-y-1.5">
        <p className="text-sm font-medium text-foreground">Nenhum job criado ainda</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Selecione o tenant correto, valide a pré-validação acima e clique em
          <span className="font-medium text-foreground"> "Novo job" </span>
          para começar sua primeira migração.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Criado</TableHead>
          <TableHead>Concluído</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => (
          <TableRow
            key={j.id}
            data-state={selectedId === j.id ? "selected" : undefined}
            className={cn("cursor-pointer", selectedId === j.id && "bg-primary/5")}
            onClick={() => onSelect(j.id)}
          >
            <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
            <TableCell><JobStatusBadge status={j.status} /></TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: ptBR })}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {j.completed_at ? formatDistanceToNow(new Date(j.completed_at), { addSuffix: true, locale: ptBR }) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
