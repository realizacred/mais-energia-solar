import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  isTipoProjetoFinanceiroPendente,
  isTipoProjetoEmAdaptacao,
  getTipoProjetoSolarLabel,
  type TipoProjetoSolar,
} from "@/lib/tipoProjetoSolar";

interface Props {
  projetoId: string | null;
}

/**
 * Alerta informativo sobre tipos de projeto solar ainda não totalmente
 * suportados pelo engine de cálculo / kit / template.
 * (Fase C — UX informativo; não bloqueia uso, não altera cálculo.)
 */
export function TipoProjetoSolarAlert({ projetoId }: Props) {
  const { data: tipo } = useQuery({
    queryKey: ["projeto-tipo-solar", projetoId],
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<TipoProjetoSolar | null> => {
      if (!projetoId) return null;
      const { data } = await supabase
        .from("projetos")
        .select("tipo_projeto_solar")
        .eq("id", projetoId)
        .maybeSingle();
      return ((data as any)?.tipo_projeto_solar as TipoProjetoSolar) ?? null;
    },
  });

  if (!tipo || !isTipoProjetoEmAdaptacao(tipo)) return null;

  const financeiroPendente = isTipoProjetoFinanceiroPendente(tipo);

  return (
    <Alert className="mb-2 border-warning/40 bg-warning/5 text-foreground">
      <AlertTriangle className="h-4 w-4 !text-warning" />
      <AlertTitle className="text-sm font-semibold">
        Tipo "{getTipoProjetoSolarLabel(tipo)}" em adaptação
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground space-y-1">
        <p>
          Os cálculos e equipamentos podem não refletir totalmente este tipo
          de sistema ainda.
        </p>
        {financeiroPendente && (
          <p>
            <strong className="text-warning">Financeiro:</strong> o cálculo
            financeiro completo será ajustado em breve. Os valores atuais são
            baseados no modelo on-grid.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
