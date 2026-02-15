import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Plus, Send, Archive, Loader2, FilePlus2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Policy {
  id: string;
  name: string;
  description: string | null;
}

interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  status: "draft" | "active" | "archived";
  published_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  policies: Policy[];
  versions: PolicyVersion[];
  selectedPolicyId: string | null;
  selectedVersionId: string | null;
  onPolicyChange: (id: string | null) => void;
  onVersionChange: (id: string | null) => void;
  onCreatePolicy: (name: string) => Promise<void>;
  onCreateVersion: () => Promise<void>;
  onPublishVersion: (id: string) => Promise<void>;
  onArchiveVersion: (id: string) => Promise<void>;
  loading: boolean;
  activeVersionStatus: "draft" | "active" | "archived" | null;
}

const STATUS_MAP = {
  draft: { variant: "warning" as const, label: "Rascunho" },
  active: { variant: "success" as const, label: "Ativa" },
  archived: { variant: "muted" as const, label: "Arquivada" },
};

export function PolicyVersionSelector({
  policies,
  versions,
  selectedPolicyId,
  selectedVersionId,
  onPolicyChange,
  onVersionChange,
  onCreatePolicy,
  onCreateVersion,
  onPublishVersion,
  onArchiveVersion,
  loading,
  activeVersionStatus,
}: Props) {
  const [newPolicyName, setNewPolicyName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreatePolicy() {
    if (!newPolicyName.trim()) return;
    setCreating(true);
    await onCreatePolicy(newPolicyName.trim());
    setNewPolicyName("");
    setDialogOpen(false);
    setCreating(false);
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          {/* Policy selector */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Política</label>
            <div className="flex gap-2">
              <Select
                value={selectedPolicyId || ""}
                onValueChange={(v) => onPolicyChange(v || null)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione uma política..." />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Política de Precificação</DialogTitle>
                    <DialogDescription>
                      Crie uma política para agrupar versões de regras financeiras.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    placeholder="Ex: Política Padrão Residencial"
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreatePolicy()}
                  />
                  <DialogFooter>
                    <Button onClick={handleCreatePolicy} disabled={creating || !newPolicyName.trim()} className="gap-2">
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Criar Política
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Version selector */}
          {selectedPolicyId && (
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Versão</label>
              <div className="flex gap-2">
                <Select
                  value={selectedVersionId || ""}
                  onValueChange={(v) => onVersionChange(v || null)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Selecione uma versão..." />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => {
                      const s = STATUS_MAP[v.status];
                      return (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            v{v.version_number}
                            <StatusBadge variant={s.variant} className="text-[10px] py-0 px-1.5">
                              {s.label}
                            </StatusBadge>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={onCreateVersion}
                  title="Nova versão (rascunho)"
                >
                  <FilePlus2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedVersion && (
            <div className="flex gap-2 pt-1">
              {selectedVersion.status === "draft" && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onPublishVersion(selectedVersion.id)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publicar
                </Button>
              )}
              {selectedVersion.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onArchiveVersion(selectedVersion.id)}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Arquivar
                </Button>
              )}
            </div>
          )}
        </div>

        {selectedVersion && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge variant={STATUS_MAP[selectedVersion.status].variant} dot>
              {STATUS_MAP[selectedVersion.status].label}
            </StatusBadge>
            <span>•</span>
            <span>
              {selectedVersion.status === "draft"
                ? "Editável — componentes e regras podem ser modificados"
                : selectedVersion.status === "active"
                ? "Imutável — em uso por propostas ativas"
                : "Arquivada — apenas leitura"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
