import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  TIPO_PROJETO_SOLAR_OPTIONS,
  DEFAULT_TIPO_PROJETO_SOLAR,
  getTipoProjetoSolarBadgeClass,
  getTipoProjetoSolarLabel,
  isTipoProjetoEmAdaptacao,
  type TipoProjetoSolar,
} from "@/lib/tipoProjetoSolar";

interface Props {
  projetoId: string | null;
  /** Permite somente leitura (ex.: projetos arquivados). */
  readOnly?: boolean;
}

/**
 * Badge editável para `projetos.tipo_projeto_solar`.
 * Fase C: apenas UI + persistência. Não dispara recálculos.
 */
export function TipoProjetoSolarBadge({ projetoId, readOnly }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tipo } = useQuery({
    queryKey: ["projeto-tipo-solar", projetoId],
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<TipoProjetoSolar> => {
      if (!projetoId) return DEFAULT_TIPO_PROJETO_SOLAR;
      const { data } = await supabase
        .from("projetos")
        .select("tipo_projeto_solar")
        .eq("id", projetoId)
        .maybeSingle();
      return ((data as any)?.tipo_projeto_solar as TipoProjetoSolar) || DEFAULT_TIPO_PROJETO_SOLAR;
    },
  });

  const mutation = useMutation({
    mutationFn: async (next: TipoProjetoSolar) => {
      if (!projetoId) throw new Error("Projeto sem ID");
      const { error } = await supabase
        .from("projetos")
        .update({ tipo_projeto_solar: next } as any)
        .eq("id", projetoId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(["projeto-tipo-solar", projetoId], next);
      qc.invalidateQueries({ queryKey: ["projeto-detalhe"] });
      toast({
        title: `Tipo alterado para ${getTipoProjetoSolarLabel(next)}`,
        description:
          "O tipo de sistema foi alterado. Os cálculos e equipamentos podem não refletir esse tipo ainda.",
      });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err?.message || "Falha", variant: "destructive" });
    },
  });

  const current = tipo || DEFAULT_TIPO_PROJETO_SOLAR;
  const badgeClass = getTipoProjetoSolarBadgeClass(current);
  const label = getTipoProjetoSolarLabel(current);
  const emAdaptacao = isTipoProjetoEmAdaptacao(current);

  const adaptacaoBadge = emAdaptacao ? (
    <Badge
      variant="outline"
      className="text-[10px] shrink-0 gap-1 bg-warning/10 text-warning border-warning/30 px-1.5 h-[22px]"
      title="Engine de cálculo, kit e template ainda não totalmente adaptados a este tipo."
    >
      Em adaptação
    </Badge>
  ) : null;

  if (readOnly || !projetoId) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={cn("text-xs shrink-0 gap-1.5", badgeClass)}>
          <Sun className="h-3 w-3" />
          {label}
        </Badge>
        {adaptacaoBadge}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-2 h-[22px] rounded-full border text-xs font-semibold transition-opacity hover:opacity-80",
            badgeClass,
          )}
          title="Tipo de projeto solar — clique para editar"
        >
          <Sun className="h-3 w-3" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Tipo de projeto solar
        </p>
        <div className="space-y-0.5">
          {TIPO_PROJETO_SOLAR_OPTIONS.map((o) => {
            const isActive = o.value === current;
            return (
              <button
                key={o.value}
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(o.value)}
                className={cn(
                  "flex items-start gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                  isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                )}
              >
                <span className={cn("mt-0.5 inline-block w-2 h-2 rounded-full shrink-0", o.badgeClass.split(" ")[0])} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{o.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{o.description}</div>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
