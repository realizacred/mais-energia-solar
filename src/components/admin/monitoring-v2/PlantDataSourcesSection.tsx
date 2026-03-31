/**
 * PlantDataSourcesSection — Full management view for Configurações tab.
 * Lists all data sources (portals) with add/remove.
 * §4: Table pattern. §12: Skeleton loading.
 */
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Radio, Trash2 } from "lucide-react";
import { usePlantDataSources, useDeletePlantDataSource } from "@/hooks/usePlantDataSources";
import { PlantDataSourceDialog } from "./PlantDataSourceDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface Props {
  plantId: string;
  tenantId: string;
}

export function PlantDataSourcesSection({ plantId, tenantId }: Props) {
  const { data: sources = [], isLoading } = usePlantDataSources(plantId);
  const deleteMut = useDeletePlantDataSource();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync({ id, plantId });
      toast.success("Portal removido");
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
              <Radio className="w-4 h-4 text-primary" />
              Portais de Coleta de Dados
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar Portal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum portal de coleta vinculado. Clique em "Adicionar Portal" para começar.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Provedor</TableHead>
                    <TableHead className="font-semibold text-foreground">Device ID</TableHead>
                    <TableHead className="font-semibold text-foreground">Label</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Adicionado em</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((src) => (
                    <TableRow key={src.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm font-medium text-foreground capitalize">
                        {src.provider ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {src.provider_device_id || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {src.label || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            src.integration_status === "connected"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }
                        >
                          {src.integration_status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(src.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover o portal da usina?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Você realmente deseja remover o portal desta usina?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(src.id)}>
                                Sim, eu quero remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PlantDataSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plantId={plantId}
        tenantId={tenantId}
      />
    </>
  );
}
