import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { UserPlus, FileText } from "lucide-react";
import { StorageFileGallery } from "@/components/ui-kit/StorageFileGallery";

import { useLeadOwnership } from "@/hooks/useLeadOwnership";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignVendorDialog } from "./AssignVendorDialog";
import { LeadOwnershipCard } from "./LeadOwnershipCard";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface OrcamentoViewDialogProps {
  orcamento: OrcamentoDisplayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function OrcamentoViewDialog({ orcamento, open, onOpenChange, onRefresh }: OrcamentoViewDialogProps) {
  
  const [assignOpen, setAssignOpen] = useState(false);
  const ownership = useLeadOwnership(open && orcamento ? orcamento.lead_id : null);

  if (!orcamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden">
        {/* §25 HEADER */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Detalhes do Orçamento
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Informações completas do orçamento e lead
            </p>
          </div>
        </DialogHeader>

        {/* §25 BODY */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Códigos */}
          <div className="flex items-center gap-2 flex-wrap">
            {orcamento.orc_code && (
              <Badge variant="default" className="font-mono text-sm px-3 py-1 bg-primary">
                {orcamento.orc_code}
              </Badge>
            )}
            {orcamento.lead_code && (
              <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                {orcamento.lead_code}
              </Badge>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dados do cliente
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium text-sm">{orcamento.nome}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium text-sm">{formatPhoneBR(orcamento.telefone)}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Endereço */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Endereço do Orçamento
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">CEP</p>
                <p className="font-medium text-sm">{orcamento.cep || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cidade/Estado</p>
                <p className="font-medium text-sm">
                  {orcamento.cidade}, {orcamento.estado}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bairro</p>
                <p className="font-medium text-sm">{orcamento.bairro || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rua</p>
                <p className="font-medium text-sm">{orcamento.rua || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="font-medium text-sm">{orcamento.numero || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consultor</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {(orcamento.vendedor_nome || orcamento.vendedor) ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {orcamento.vendedor_nome || orcamento.vendedor}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sem consultor</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setAssignOpen(true)}
                  >
                    <UserPlus className="w-3 h-3" />
                    {(orcamento.vendedor_nome || orcamento.vendedor) ? "Trocar" : "Atribuir"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Ownership History */}
          <LeadOwnershipCard ownership={ownership} />

          <div className="border-t border-border" />

          {/* Imóvel */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Imóvel e Consumo
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="font-medium text-sm">{orcamento.area}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Telhado</p>
                <p className="font-medium text-sm">{orcamento.tipo_telhado}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rede</p>
                <p className="font-medium text-sm">{orcamento.rede_atendimento}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Médio</p>
                <p className="font-medium text-sm">{orcamento.media_consumo} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Previsto</p>
                <p className="font-medium text-sm">{orcamento.consumo_previsto} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                <p className="font-medium text-sm">
                  {format(new Date(orcamento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          </div>

          {orcamento.observacoes && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="font-medium text-sm">{orcamento.observacoes}</p>
              </div>
            </>
          )}

          {/* Arquivos Anexados */}
          {orcamento.arquivos_urls && orcamento.arquivos_urls.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Arquivos Anexados ({orcamento.arquivos_urls.length})
                </p>
                <StorageFileGallery bucket="contas-luz" filePaths={orcamento.arquivos_urls} />
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {/* Assign Vendor Dialog */}
      <AssignVendorDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        orcamentoId={orcamento.id}
        leadId={orcamento.lead_id}
        currentVendedorId={orcamento.vendedor_id}
        currentVendedorNome={orcamento.vendedor_nome}
        clienteNome={orcamento.nome}
        onSuccess={() => {
          onRefresh?.();
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
