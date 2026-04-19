/**
 * NewJobModal — Modal para criar novo job de migração.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useCreateMigrationJob, type JobType } from "@/hooks/useCreateMigrationJob";
import { Loader2 } from "lucide-react";

const OPTIONS: Array<{ value: JobType; label: string; description: string }> = [
  { value: "full_migration", label: "Migração completa", description: "Classifica → clientes → projetos → propostas." },
  { value: "classify_projects", label: "Classificar projetos", description: "Apenas classifica e resolve funis de destino." },
  { value: "migrate_clients", label: "Migrar clientes", description: "Cria/reaproveita clientes nativos." },
  { value: "migrate_projects", label: "Migrar projetos", description: "Cria projetos a partir das classificações." },
  { value: "migrate_proposals", label: "Migrar propostas", description: "Cria propostas comerciais para projetos migrados." },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (jobId: string) => void;
  tenantId: string | null;
}

export function NewJobModal({ open, onOpenChange, onCreated, tenantId }: Props) {
  const [type, setType] = useState<JobType>("full_migration");
  const create = useCreateMigrationJob();

  const handleCreate = async () => {
    if (!tenantId) return;
    const jobId = await create.mutateAsync({ job_type: type, tenant_id: tenantId });
    onCreated?.(jobId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo job de migração</DialogTitle>
          <DialogDescription>Selecione o tipo de operação a executar.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={type} onValueChange={(v) => setType(v as JobType)} className="space-y-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={opt.value}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
              <div className="min-w-0">
                <Label htmlFor={opt.value} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={create.isPending || !tenantId}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar e executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
