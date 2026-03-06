/**
 * UCsListPage — Main list page for Unidades Consumidoras.
 * Features: search, filters by tipo_uc, archive toggle, CRUD actions.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unitService, type UCRecord } from "@/services/unitService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Archive, Eye, Edit, Trash2, Zap, Building2, ArrowDownToLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UCFormDialog } from "./UCFormDialog";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Consumo",
  gd_geradora: "GD Geradora",
  beneficiaria: "Beneficiária",
};

const UC_TYPE_COLORS: Record<string, "default" | "success" | "info"> = {
  consumo: "default",
  gd_geradora: "success",
  beneficiaria: "info",
};

export default function UCsListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUC, setEditingUC] = useState<UCRecord | null>(null);

  const { data: ucs = [], isLoading, error } = useQuery({
    queryKey: ["units_consumidoras", tipoFilter, showArchived, search],
    queryFn: () => unitService.list({
      tipo_uc: tipoFilter !== "all" ? tipoFilter : undefined,
      is_archived: showArchived ? undefined : false,
      search: search || undefined,
    }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => unitService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units_consumidoras"] });
      toast({ title: "UC arquivada com sucesso" });
    },
  });

  function handleEdit(uc: UCRecord) {
    setEditingUC(uc);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingUC(null);
    setDialogOpen(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Unidades Consumidoras"
        description="Gerencie UCs, faturas, medidores e vínculos com usinas"
        actions={
          <Button onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova UC
          </Button>
        }
      />

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de UC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="consumo">Consumo</SelectItem>
              <SelectItem value="gd_geradora">GD Geradora</SelectItem>
              <SelectItem value="beneficiaria">Beneficiária</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4 mr-1" />
            {showArchived ? "Mostrando arquivadas" : "Mostrar arquivadas"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <EmptyState icon="AlertTriangle" title="Erro ao carregar" description={String(error)} />
        ) : ucs.length === 0 ? (
          <EmptyState
            icon="Building2"
            title="Nenhuma UC cadastrada"
            description="Cadastre sua primeira unidade consumidora para começar a gerenciar faturas e medidores."
            action={<Button onClick={handleCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova UC</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código UC</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concessionária</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ucs.map((uc) => (
                  <TableRow key={uc.id} className="group">
                    <TableCell className="font-medium">{uc.nome}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{uc.codigo_uc}</TableCell>
                    <TableCell>
                      <Badge variant={UC_TYPE_COLORS[uc.tipo_uc] || "default"} className="text-xs">
                        {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{uc.concessionaria_nome || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` / ${uc.classificacao_subgrupo}` : ""}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
                        {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(uc)} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!uc.is_archived && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => archiveMut.mutate(uc.id)} title="Arquivar">
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <UCFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUC={editingUC}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["units_consumidoras"] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
