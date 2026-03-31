/**
 * GdGroupsPage — Main page for GD & Credit Allocation management.
 * Route: /admin/gd-rateio
 */
import { useState } from "react";
import { useGdGroups } from "@/hooks/useGdGroups";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useUCsList, useClientesList } from "@/hooks/useFormSelects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Plus, MoreHorizontal, Eye, Pencil, Users, AlertTriangle } from "lucide-react";
import { GdGroupFormModal } from "./GdGroupFormModal";
import { GdGroupDetailModal } from "./GdGroupDetailModal";
import type { GdGroup } from "@/hooks/useGdGroups";

export function GdGroupsPage() {
  const { data: groups = [], isLoading } = useGdGroups();
  const { data: concessionarias = [] } = useConcessionarias();
  const { data: ucs = [] } = useUCsList();
  const { data: clientes = [] } = useClientesList();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GdGroup | null>(null);
  const [detailGroup, setDetailGroup] = useState<GdGroup | null>(null);

  // Fetch beneficiary counts per group
  const { data: benCounts = [] } = useQuery({
    queryKey: ["gd_ben_counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gd_group_beneficiaries")
        .select("gd_group_id, is_active");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const ucMap = new Map(ucs.map((u) => [u.id, u]));
  const concMap = new Map(concessionarias.map((c) => [c.id, c]));
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));
  const benCountMap = new Map<string, number>();
  benCounts.forEach((b: any) => {
    if (b.is_active) {
      benCountMap.set(b.gd_group_id, (benCountMap.get(b.gd_group_id) || 0) + 1);
    }
  });

  function handleEdit(g: GdGroup) {
    setEditingGroup(g);
    setFormOpen(true);
  }

  function handleNew() {
    setEditingGroup(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header — §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">GD e Rateio de Créditos</h1>
            <p className="text-sm text-muted-foreground">Gerencie UC geradora, beneficiárias e percentuais de compensação</p>
          </div>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Grupo GD
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Sun className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Nenhum grupo GD cadastrado</p>
          <p className="text-sm text-muted-foreground">Crie um grupo para gerenciar UCs geradoras e beneficiárias</p>
          <Button size="sm" onClick={handleNew}><Plus className="w-4 h-4 mr-1" /> Criar Grupo</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Grupo</TableHead>
                <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                <TableHead className="font-semibold text-foreground">UC Geradora</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Beneficiárias</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const uc = ucMap.get(g.uc_geradora_id);
                const conc = concMap.get(g.concessionaria_id);
                const cliente = g.cliente_id ? clienteMap.get(g.cliente_id) : null;
                const benCount = benCountMap.get(g.id) || 0;
                return (
                  <TableRow
                    key={g.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setDetailGroup(g)}
                  >
                    <TableCell className="font-medium text-foreground">{g.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{cliente?.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{conc?.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {uc ? `${uc.codigo_uc} — ${uc.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {benCount === 0 ? (
                        <Badge variant="outline" className="text-xs border-warning text-warning">
                          <AlertTriangle className="w-3 h-3 mr-1" /> 0
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {benCount}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.status === "active" ? "default" : "secondary"} className="text-xs">
                        {g.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailGroup(g); }}>
                            <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(g); }}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Modal */}
      <GdGroupFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editingGroup={editingGroup}
      />

      {/* Detail Modal */}
      {detailGroup && (
        <GdGroupDetailModal
          open={!!detailGroup}
          onOpenChange={(v) => !v && setDetailGroup(null)}
          groupId={detailGroup.id}
        />
      )}
    </div>
  );
}
