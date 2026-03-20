/**
 * PlantDataSourcesBadges — Compact portal badges for Visão Geral tab.
 * Shows provider avatars + "+" button to add new portal, like SolarZ.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X } from "lucide-react";
import { usePlantDataSources, useDeletePlantDataSource } from "@/hooks/usePlantDataSources";
import { PlantDataSourceDialog } from "./PlantDataSourceDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  plantId: string;
  tenantId: string;
}

/** Provider initial letter as colored circle avatar */
function ProviderAvatar({ provider, label }: { provider: string; label: string | null }) {
  const initials = (provider || "?").substring(0, 2).toUpperCase();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative group">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold cursor-default shrink-0">
            {initials}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label || provider}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function PlantDataSourcesBadges({ plantId, tenantId }: Props) {
  const { data: sources = [], isLoading } = usePlantDataSources(plantId);
  const deleteMut = useDeletePlantDataSource();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id, plantId });
      toast.success("Portal removido");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Portal</p>
        <div className="flex items-center gap-2 flex-wrap">
          {sources.map((src) => (
            <div key={src.id} className="relative group">
              <ProviderAvatar provider={src.provider ?? "?"} label={src.label} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0"
                onClick={() => setDeleteTarget({ id: src.id, label: src.label || src.provider || "Portal" })}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Adicionar portal</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <PlantDataSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plantId={plantId}
        tenantId={tenantId}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o portal da usina?</AlertDialogTitle>
            <AlertDialogDescription>
              Você realmente deseja remover o portal "{deleteTarget?.label}" desta usina?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar, não quero remover</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Sim, eu quero remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
