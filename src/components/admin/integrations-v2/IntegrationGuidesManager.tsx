import React, { useState } from "react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useIntegrationGuides, useDeleteIntegrationGuide, useSaveIntegrationGuide } from "@/hooks/useIntegrationGuides";
import type { IntegrationGuide } from "@/hooks/useIntegrationGuides";
import { toast } from "sonner";
import { IntegrationGuideEditorModal } from "./IntegrationGuideEditorModal";

export default function IntegrationGuidesManager() {
  const { data: guides = [], isLoading } = useIntegrationGuides();
  const deleteMut = useDeleteIntegrationGuide();
  const saveMut = useSaveIntegrationGuide();
  const [search, setSearch] = useState("");
  const [editorGuide, setEditorGuide] = useState<IntegrationGuide | null | "new">(null);

  const filtered = guides.filter((g) => {
    const q = search.toLowerCase();
    return !q || g.provider_id.toLowerCase().includes(q) || g.title.toLowerCase().includes(q);
  });

  const handleDelete = async (guide: IntegrationGuide) => {
    if (!confirm(`Excluir guia "${guide.title}"?`)) return;
    try {
      await deleteMut.mutateAsync(guide.id);
      toast.success("Guia excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleToggleActive = async (guide: IntegrationGuide) => {
    try {
      await saveMut.mutateAsync({
        id: guide.id,
        provider_id: guide.provider_id,
        title: guide.title,
        steps: guide.steps,
        is_active: !guide.is_active,
      });
      toast.success(guide.is_active ? "Guia desativado" : "Guia ativado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Tutoriais de Integração"
        description="Gerencie guias passo a passo para configuração de provedores"
        icon={BookOpen}
        actions={
          <Button size="sm" onClick={() => setEditorGuide("new")}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Guia
          </Button>
        }
      />

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por provider ou título…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm bg-card border-border"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum guia encontrado"
          description="Crie um guia para ajudar na configuração de integrações"
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Provider</TableHead>
                <TableHead className="font-semibold text-foreground">Título</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Passos</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Escopo</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((guide) => (
                <TableRow
                  key={guide.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setEditorGuide(guide)}
                >
                  <TableCell className="font-mono text-sm text-foreground">{guide.provider_id}</TableCell>
                  <TableCell className="font-medium text-foreground">{guide.title}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{guide.steps?.length || 0}</TableCell>
                  <TableCell className="text-center">
                    {guide.is_active ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {guide.tenant_id ? (
                      <Badge variant="outline" className="text-xs">Tenant</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Global</Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditorGuide(guide)}>
                          <Pencil className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(guide)}>
                          {guide.is_active ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                          {guide.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(guide)}>
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Editor modal */}
      {editorGuide !== null && (
        <IntegrationGuideEditorModal
          open
          onOpenChange={(open) => { if (!open) setEditorGuide(null); }}
          guide={editorGuide === "new" ? null : editorGuide}
          onSuccess={() => setEditorGuide(null)}
        />
      )}
    </div>
  );
}
