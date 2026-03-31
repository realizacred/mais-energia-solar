/**
 * PlantResizingSection — Displays plant resizing history table + add button.
 * §4: Table pattern. §12: Skeleton loading. §22: Button variants.
 */
import { useState } from "react";
import { formatDecimalBR } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Maximize2, Trash2, Edit } from "lucide-react";
import { usePlantResizingHistory, useDeletePlantResizing } from "@/hooks/usePlantResizingHistory";
import { PlantResizingDialog } from "./PlantResizingDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface Props {
  plantId: string;
  tenantId: string;
}

export function PlantResizingSection({ plantId, tenantId }: Props) {
  const { data: rows = [], isLoading } = usePlantResizingHistory(plantId);
  const deleteMut = useDeletePlantResizing();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync({ id, plantId });
      toast.success("Registro removido");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-primary" />
              Histórico de Potência da Usina
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo dado histórico
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum registro de ampliação cadastrado.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Data da mudança</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Potência</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Total investido até então</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Geração Anual Esperada</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Geração Anual Acordada Na Venda</TableHead>
                    <TableHead className="font-semibold text-foreground">Comentário</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm font-medium text-primary">
                        {format(parseISO(row.data_ampliacao), "dd-MM-yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {formatDecimalBR(Number(row.potencia_kwp), 3)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {row.valor_investido_total != null
                          ? Number(row.valor_investido_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {row.geracao_anual_prevista_kwh != null
                          ? Number(row.geracao_anual_prevista_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {row.geracao_anual_acordada_kwh != null
                          ? Number(row.geracao_anual_acordada_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {row.comentario || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(row.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      <PlantResizingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plantId={plantId}
        tenantId={tenantId}
      />
    </>
  );
}
