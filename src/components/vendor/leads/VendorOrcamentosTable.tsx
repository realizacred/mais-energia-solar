import { useState } from "react";
import { Phone, Eye, Trash2, ShoppingCart, UserCheck, MessageSquare, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScheduleWhatsAppDialog } from "@/components/vendor/ScheduleWhatsAppDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrcamentoStatusSelector } from "@/components/vendor/OrcamentoStatusSelector";
import { VendorOrcamentoCard } from "./VendorOrcamentoCard";
import { OrcamentoHistoryDialog } from "@/components/admin/leads/OrcamentoHistoryDialog";
import { useGroupedOrcamentos, type GroupedOrcamento } from "@/hooks/useGroupedOrcamentos";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadStatus } from "@/types/lead";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface VendorOrcamentosTableProps {
  orcamentos: OrcamentoVendedor[];
  statuses: LeadStatus[];
  onToggleVisto: (orcamento: OrcamentoVendedor) => void;
  onView: (orcamento: OrcamentoVendedor) => void;
  onStatusChange: (orcamentoId: string, newStatusId: string | null) => void;
  onDelete?: (orcamento: OrcamentoVendedor) => void;
  onConvert?: (orcamento: OrcamentoVendedor) => void;
}

export function VendorOrcamentosTable({ 
  orcamentos, 
  statuses, 
  onToggleVisto, 
  onView,
  onStatusChange,
  onDelete,
  onConvert
}: VendorOrcamentosTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orcamentoToDelete, setOrcamentoToDelete] = useState<OrcamentoVendedor | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedOrcForWhatsapp, setSelectedOrcForWhatsapp] = useState<OrcamentoVendedor | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedOrcamento | null>(null);
  const isMobile = useIsMobile();

  const groupedOrcamentos = useGroupedOrcamentos(orcamentos);

  const handleWhatsappClick = (orc: OrcamentoVendedor) => {
    setSelectedOrcForWhatsapp(orc);
    setWhatsappDialogOpen(true);
  };

  const handleDeleteClick = (orcamento: OrcamentoVendedor) => {
    setOrcamentoToDelete(orcamento);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (orcamentoToDelete && onDelete) {
      onDelete(orcamentoToDelete);
    }
    setDeleteDialogOpen(false);
    setOrcamentoToDelete(null);
  };

  const handleOpenHistory = (group: GroupedOrcamento) => {
    setSelectedGroup(group);
    setHistoryOpen(true);
  };

  const handleWhatsAppFromHistory = (telefone: string, nome: string, leadId: string) => {
    setHistoryOpen(false);
    const orc = orcamentos.find((o) => o.lead_id === leadId);
    if (orc) {
      setSelectedOrcForWhatsapp(orc);
      setWhatsappDialogOpen(true);
    }
  };

  const getConvertedStatus = () => statuses.find(s => s.nome === "Convertido");

  if (groupedOrcamentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum orçamento encontrado
      </div>
    );
  }

  // Mobile: Card Layout
  if (isMobile) {
    const convertidoStatus = getConvertedStatus();
    
    return (
      <>
        <div className="space-y-3">
          {groupedOrcamentos.map((group) => {
            const orc = group.latestOrcamento as OrcamentoVendedor;
            const isConverted = convertidoStatus && orc.status_id === convertidoStatus.id;
            
            return (
              <div key={group.lead_id}>
                {group.count > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-1 h-6 px-2 gap-1 text-xs text-muted-foreground"
                    onClick={() => handleOpenHistory(group)}
                  >
                    <History className="h-3 w-3" />
                    {group.count} orçamentos
                  </Button>
                )}
                <VendorOrcamentoCard
                  orcamento={orc}
                  statuses={statuses}
                  isConverted={!!isConverted}
                  onToggleVisto={() => onToggleVisto(orc)}
                  onView={() => onView(orc)}
                  onStatusChange={(newStatusId) => onStatusChange(orc.id, newStatusId)}
                  onDelete={onDelete ? () => handleDeleteClick(orc) : undefined}
                  onConvert={onConvert ? () => {
                    // Se houver múltiplos orçamentos, abrir histórico para escolher
                    if (group.count > 1) {
                      handleOpenHistory(group);
                    } else {
                      onConvert(orc);
                    }
                  } : undefined}
                />
              </div>
            );
          })}
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o orçamento de <strong>{orcamentoToDelete?.nome}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <OrcamentoHistoryDialog
          group={selectedGroup}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          statuses={statuses}
          onViewOrcamento={(orc) => onView(orc as OrcamentoVendedor)}
          onWhatsApp={handleWhatsAppFromHistory}
          onConvertOrcamento={onConvert ? (orc) => onConvert(orc as OrcamentoVendedor) : undefined}
        />
      </>
    );
  }

  // Desktop: Table Layout
  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Visto</TableHead>
              <TableHead className="w-28">Orçamento</TableHead>
              <TableHead className="w-24">Cliente</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Consumo / Geração</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedOrcamentos.map((group) => {
              const orc = group.latestOrcamento as OrcamentoVendedor;
              const convertidoStatus = getConvertedStatus();
              const isConverted = convertidoStatus && orc.status_id === convertidoStatus.id;
              const hasHistory = group.count > 1;
              
              return (
                <TableRow
                  key={group.lead_id}
                  className={`${orc.visto ? "bg-green-50/50 dark:bg-green-950/20" : ""} ${isConverted ? "bg-primary/5" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={orc.visto}
                      onCheckedChange={() => onToggleVisto(orc)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant="default" className="font-mono text-xs">
                        {orc.orc_code || "-"}
                      </Badge>
                      {hasHistory && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                onClick={() => handleOpenHistory(group)}
                              >
                                <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">
                                  +{group.count - 1}
                                </Badge>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Ver {group.count} orçamentos deste cliente
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {orc.lead_code || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{orc.nome}</span>
                      {!orc.visto && (
                        <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                          Novo
                        </Badge>
                      )}
                      {hasHistory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 gap-1 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenHistory(group)}
                        >
                          <History className="h-3 w-3" />
                          Histórico
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a 
                      href={`https://wa.me/55${orc.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {orc.telefone}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-primary/40 bg-primary/5 text-primary font-medium"
                    >
                      {orc.cidade}, {orc.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{orc.media_consumo} kWh</span>
                      <span className="text-xs text-muted-foreground">
                        Geração: {orc.consumo_previsto} kWh
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OrcamentoStatusSelector
                      orcamentoId={orc.id}
                      currentStatusId={orc.status_id}
                      statuses={statuses}
                      onStatusChange={(newStatusId) => onStatusChange(orc.id, newStatusId)}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(orc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleWhatsappClick(orc)}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Enviar WhatsApp</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-secondary hover:text-secondary"
                              onClick={() => onView(orc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver detalhes</TooltipContent>
                        </Tooltip>
                        {onConvert && !isConverted && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  if (hasHistory) {
                                    handleOpenHistory(group);
                                  } else {
                                    onConvert(orc);
                                  }
                                }}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {hasHistory ? "Escolher orçamento para converter" : "Converter em Venda"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isConverted && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center h-8 w-8 text-primary">
                                <UserCheck className="w-4 h-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Já convertido em cliente</TooltipContent>
                          </Tooltip>
                        )}
                        {onDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(orc)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir orçamento</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento de <strong>{orcamentoToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScheduleWhatsAppDialog
        lead={selectedOrcForWhatsapp ? {
          id: selectedOrcForWhatsapp.lead_id,
          nome: selectedOrcForWhatsapp.nome,
          telefone: selectedOrcForWhatsapp.telefone,
        } : null}
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
      />

      <OrcamentoHistoryDialog
        group={selectedGroup}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        statuses={statuses}
        onViewOrcamento={(orc) => onView(orc as OrcamentoVendedor)}
        onWhatsApp={handleWhatsAppFromHistory}
        onConvertOrcamento={onConvert ? (orc) => onConvert(orc as OrcamentoVendedor) : undefined}
      />
    </>
  );
}
