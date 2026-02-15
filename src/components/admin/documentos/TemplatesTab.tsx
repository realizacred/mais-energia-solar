import { useState } from "react";
import { Plus, Download, Copy, Archive, Pencil, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useDocumentTemplates } from "./useDocumentTemplates";
import { TemplateModal } from "./TemplateModal";
import { CATEGORY_LABELS, type DocumentCategory, type DocumentTemplate } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const ALL_CATS: (DocumentCategory | "all")[] = ["all", "contrato", "procuracao", "proposta", "termo"];

export function TemplatesTab() {
  const [catFilter, setCatFilter] = useState<DocumentCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);

  const { data: templates, isLoading, upsert, archive, duplicate } = useDocumentTemplates(
    catFilter === "all" ? undefined : catFilter
  );

  const filtered = (templates ?? []).filter((t) => {
    if (search && !t.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const active = filtered.filter((t) => t.status === "active");
  const archived = filtered.filter((t) => t.status === "archived");

  const handleDownload = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from("document-files").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link de download");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={catFilter} onValueChange={(v) => setCatFilter(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7 px-3">Todos</TabsTrigger>
            {(Object.entries(CATEGORY_LABELS) as [DocumentCategory, string][]).map(([k, v]) => (
              <TabsTrigger key={k} value={k} className="text-xs h-7 px-3">{v}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="h-8 w-48 pl-8 text-xs" />
          </div>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Novo template
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : active.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum template cadastrado</p>
          <Button variant="outline" size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro template
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Categoria</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Versão</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">Assina?</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Atualizado</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {active.map((tpl, idx) => (
                <tr key={tpl.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{tpl.nome}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[tpl.categoria] || tpl.categoria}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">v{tpl.version}</td>
                  <td className="px-3 py-2 text-center">
                    {tpl.requires_signature_default ? (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-0">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{format(new Date(tpl.updated_at), "dd/MM/yy HH:mm")}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(tpl.docx_storage_path)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">Download</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(tpl); setModalOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">Editar</TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <span className="text-sm">⋯</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => duplicate.mutate(tpl.id)} className="text-xs gap-2">
                            <Copy className="h-3.5 w-3.5" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archive.mutate(tpl.id)} className="text-xs gap-2 text-destructive">
                            <Archive className="h-3.5 w-3.5" /> Arquivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TemplateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={editing}
        onSave={(data) => {
          upsert.mutate(data, { onSuccess: () => setModalOpen(false) });
        }}
        saving={upsert.isPending}
      />
    </div>
  );
}
