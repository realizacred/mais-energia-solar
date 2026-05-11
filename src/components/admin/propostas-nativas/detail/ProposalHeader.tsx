/**
 * ProposalHeader.tsx
 *
 * Header section of ProposalDetail — title (projeto.nome), status badge, metadata.
 * H1 = projeto.nome (fallback: cliente.nome). Subtitle = cliente.nome.
 */

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hash, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { ProposalViewModel } from "@/domain/proposal/ProposalViewModel";
import { getStatusConfig } from "@/domain/proposal/proposalState";
import { getProjetoDisplayName } from "@/lib/format-entity-labels";

interface ProposalHeaderProps {
  vm: ProposalViewModel;
  clienteNome: string | null;
  projetoId?: string | null;
}

export function ProposalHeader({ vm, clienteNome, projetoId }: ProposalHeaderProps) {
  const navigate = useNavigate();
  const statusInfo = getStatusConfig(vm.businessStatus);
  const StatusIcon = statusInfo.icon;

  const { data: projeto } = useQuery({
    queryKey: ["proposta-projeto-header", projetoId],
    queryFn: async () => {
      if (!projetoId) return null;
      const { data } = await supabase
        .from("projetos")
        .select("nome, codigo, projeto_num")
        .eq("id", projetoId)
        .maybeSingle();
      return data as { nome: string | null; codigo: string | null; projeto_num: number | null } | null;
    },
    enabled: !!projetoId,
    staleTime: 60_000,
  });

  const titulo = projeto
    ? getProjetoDisplayName({ nome: projeto.nome, codigo: projeto.codigo, projeto_num: projeto.projeto_num })
    : (vm.clienteNome || "Proposta");

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">{titulo}</h1>
          <Badge variant={statusInfo.variant} className="text-[10px] gap-1 px-2">
            <StatusIcon className="h-3 w-3" />
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {vm.codigo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{vm.codigo}</span>}
          {clienteNome && <span className="flex items-center gap-1"><User className="h-3 w-3" />{clienteNome}</span>}
          {vm.snapshot.locCidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{vm.snapshot.locCidade}/{vm.snapshot.locEstado}</span>}
        </div>
      </div>
    </div>
  );
}
