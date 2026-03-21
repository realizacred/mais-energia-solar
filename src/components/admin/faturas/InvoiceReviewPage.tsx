/**
 * InvoiceReviewPage — Manual review of failed/unmatched invoice import items.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInvoiceReviewItems } from "@/hooks/useInvoicesList";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle, XCircle, Link2, FileSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function InvoiceReviewPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useInvoiceReviewItems();
  const [linkItem, setLinkItem] = useState<any | null>(null);
  const [selectedUcId, setSelectedUcId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  // UCs for linking
  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_review"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("is_archived", false)
        .order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  async function handleLink() {
    if (!linkItem || !selectedUcId) return;
    setLinking(true);
    try {
      // Update the item to mark it as imported with the linked UC
      await (supabase as any)
        .from("invoice_import_job_items")
        .update({
          unit_id: selectedUcId,
          status: "imported",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkItem.id);

      toast({ title: "Item vinculado com sucesso" });
      qc.invalidateQueries({ queryKey: ["invoice_review_items"] });
      setLinkItem(null);
      setSelectedUcId("");
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  }

  async function handleIgnore(itemId: string) {
    try {
      await (supabase as any)
        .from("invoice_import_job_items")
        .update({
          status: "duplicate",
          error_message: "Ignorado manualmente",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      toast({ title: "Item ignorado" });
      qc.invalidateQueries({ queryKey: ["invoice_review_items"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileSearch}
        title="Revisão de Faturas"
        description="Itens com erro ou UC não identificada que precisam de revisão manual"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {items.filter((i: any) => i.status === "failed").length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Com erro</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {items.filter((i: any) => !i.unit_id).length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Sem UC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{items.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Total pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum item pendente de revisão</p>
              <p className="text-xs text-muted-foreground mt-1">Todas as importações foram processadas com sucesso</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Arquivo</TableHead>
                    <TableHead className="font-semibold text-foreground">Referência</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Erro</TableHead>
                    <TableHead className="font-semibold text-foreground">Data</TableHead>
                    <TableHead className="w-[160px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm font-medium text-foreground max-w-[200px] truncate">
                        {item.file_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.reference_month && item.reference_year
                          ? `${String(item.reference_month).padStart(2, "0")}/${item.reference_year}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                          Erro
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                        {item.error_message || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setLinkItem(item);
                              setSelectedUcId(item.unit_id || "");
                            }}
                          >
                            <Link2 className="w-3 h-3 mr-1" /> Vincular
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleIgnore(item.id)}
                          >
                            Ignorar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link UC Dialog */}
      <Dialog open={!!linkItem} onOpenChange={(o) => !o && setLinkItem(null)}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Vincular UC
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {linkItem?.file_name}
              </p>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              {linkItem?.error_message && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive">{linkItem.error_message}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Selecione a UC
                </label>
                <Select value={selectedUcId} onValueChange={setSelectedUcId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma UC..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ucs.map((uc: any) => (
                      <SelectItem key={uc.id} value={uc.id}>
                        {uc.codigo_uc} — {uc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setLinkItem(null)} disabled={linking}>
              Cancelar
            </Button>
            <Button onClick={handleLink} disabled={!selectedUcId || linking}>
              {linking ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
