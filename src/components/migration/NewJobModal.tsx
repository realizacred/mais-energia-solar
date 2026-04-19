/**
 * NewJobModal — Modal para criar novo job de migração.
 *
 * UX:
 *  - Cada tipo de job exibe descrição + badges de dependência/risco.
 *  - Avisa quando a ação cria dados nativos (irreversível sem rollback).
 *  - Botão protegido contra clique duplo: disabled durante mutate.
 *  - Bloqueio explícito quando não há tenant ou staging.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCreateMigrationJob, type JobType } from "@/hooks/useCreateMigrationJob";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag =
  | "creates_data"
  | "requires_classification"
  | "requires_projects"
  | "structural"
  | "read_only";

const TAG_META: Record<Tag, { label: string; cls: string }> = {
  creates_data: { label: "Cria dados nativos", cls: "border-warning/40 text-warning bg-warning/5" },
  requires_classification: {
    label: "Requer classificação",
    cls: "border-primary/40 text-primary bg-primary/5",
  },
  requires_projects: {
    label: "Requer projetos migrados",
    cls: "border-primary/40 text-primary bg-primary/5",
  },
  structural: {
    label: "Ação estrutural",
    cls: "border-destructive/40 text-destructive bg-destructive/5",
  },
  read_only: {
    label: "Sem efeito nativo",
    cls: "border-muted-foreground/30 text-muted-foreground",
  },
};

const OPTIONS: Array<{
  value: JobType;
  label: string;
  description: string;
  tags: Tag[];
}> = [
  {
    value: "full_migration",
    label: "Migração completa",
    description: "Classifica → clientes → projetos → propostas. Use após validar tenant e prévia.",
    tags: ["structural", "creates_data"],
  },
  {
    value: "classify_projects",
    label: "Classificar projetos",
    description: "Resolve funis e etapas de destino. Não cria dados nativos.",
    tags: ["read_only"],
  },
  {
    value: "migrate_clients",
    label: "Migrar clientes",
    description: "Cria/reaproveita clientes nativos a partir do staging.",
    tags: ["creates_data"],
  },
  {
    value: "migrate_projects",
    label: "Migrar projetos",
    description: "Cria projetos a partir das classificações resolvidas.",
    tags: ["requires_classification", "creates_data"],
  },
  {
    value: "migrate_proposals",
    label: "Migrar propostas",
    description: "Cria propostas comerciais para projetos já migrados.",
    tags: ["requires_projects", "creates_data"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (jobId: string) => void;
  tenantId: string | null;
  blocked?: boolean;
  blockReason?: string | null;
}

export function NewJobModal({
  open,
  onOpenChange,
  onCreated,
  tenantId,
  blocked = false,
  blockReason = null,
}: Props) {
  const [type, setType] = useState<JobType>("full_migration");
  const create = useCreateMigrationJob();

  const handleCreate = async () => {
    if (!tenantId || create.isPending || blocked) return;
    const jobId = await create.mutateAsync({ job_type: type, tenant_id: tenantId });
    onCreated?.(jobId);
    onOpenChange(false);
  };

  const selected = OPTIONS.find((o) => o.value === type)!;
  const isStructural = selected.tags.includes("structural");
  const createsData = selected.tags.includes("creates_data");

  const disabled = create.isPending || !tenantId || blocked;
  const disabledTitle = !tenantId
    ? "Selecione um tenant"
    : blocked
    ? blockReason ?? "Execução bloqueada"
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo job de migração</DialogTitle>
          <DialogDescription>
            Selecione o tipo de operação a executar. Ações que criam dados nativos podem
            ser desfeitas via "Reverter" no detalhe do job.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={type} onValueChange={(v) => setType(v as JobType)} className="space-y-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={opt.value}
              className={cn(
                "flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                type === opt.value && "border-primary/50 bg-primary/5",
              )}
            >
              <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Label htmlFor={opt.value} className="text-sm font-medium cursor-pointer">
                    {opt.label}
                  </Label>
                  {opt.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className={cn("text-[10px] font-normal", TAG_META[t].cls)}
                    >
                      {TAG_META[t].label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        {(isStructural || createsData) && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {isStructural
                ? "Ação estrutural — executa a sequência completa. Use após validar a prévia."
                : "Esta ação cria registros no sistema nativo. Para desfazer, use Reverter."}
            </span>
          </div>
        )}

        {blocked && blockReason && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{blockReason}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={disabled} title={disabledTitle}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar e executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
