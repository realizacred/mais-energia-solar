import { useState } from "react";
import { Phone, Eye, Trash2, ShoppingCart, UserCheck, MessageSquare, History, Pencil, ScrollText } from "lucide-react";
import { usePropostaRapidaLead } from "@/hooks/usePropostaRapidaLead";
import { ButtonLoader } from "@/components/loading/ButtonLoader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { LeadEditDialog } from "@/components/admin/leads/LeadEditDialog";
import { useGroupedOrcamentos, type GroupedOrcamento } from "@/hooks/useGroupedOrcamentos";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadStatus } from "@/types/lead";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { OrcamentoSortOption } from "@/hooks/useOrcamentoSort";

interface VendorOrcamentosTableProps {
  orcamentos: OrcamentoVendedor[];
  statuses: LeadStatus[];
  sortOption?: OrcamentoSortOption;
  onToggleVisto: (orcamento: OrcamentoVendedor) => void;
  onView: (orcamento: OrcamentoVendedor) => void;
  onStatusChange: (orcamentoId: string, newStatusId: string | null) => void;
  onDelete?: (orcamento: OrcamentoVendedor) => void;
  onConvert?: (orcamento: OrcamentoVendedor) => void;
  onRefresh?: () => void;
}

export function VendorOrcamentosTable({ 
  orcamentos, 
  statuses, 
  sortOption = "recent",
  onToggleVisto, 
  onView,
  onStatusChange,
  onDelete,
  onConvert,
  onRefresh,
}: VendorOrcamentosTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orcamentoToDelete, setOrcamentoToDelete] = useState<OrcamentoVendedor | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedOrcamento | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrcamento, setEditOrcamento] = useState<OrcamentoVendedor | null>(null);
  const isMobile = useIsMobile();
  const { quickConvertToProposal, loading: quickLoading } = usePropostaRapidaLead();

  const orcToQuickLead = (orc: OrcamentoVendedor) => ({
    id: orc.lead_id,
    nome: orc.nome,
    telefone: orc.telefone,
    cidade: orc.cidade,
    estado: orc.estado,
    bairro: orc.bairro,
    rua: orc.rua,
    cep: orc.cep,
  });

  const groupedOrcamentos = useGroupedOrcamentos(orcamentos, sortOption);

  const getWhatsAppUrl = (telefone: string) =>
    `https://wa.me/55${telefone.replace(/\D/g, '')}`;


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

  const handleWhatsAppFromHistory = (telefone: string, _nome: string, _leadId: string) => {
    setHistoryOpen(false);
    window.open(getWhatsAppUrl(telefone), '_blank');
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
            <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                  className={`align-middle ${orc.visto ? "bg-success/5" : ""} ${isConverted ? "bg-primary/5" : ""}`}
                >
                  <TableCell className="align-middle">
                    <Checkbox
                      checked={orc.visto}
                      onCheckedChange={() => onToggleVisto(orc)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableCell>
                  <TableCell className="align-middle">
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
                  <TableCell className="align-middle">
                    <Badge variant="outline" className="font-mono text-xs">
                      {orc.lead_code || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-middle">
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
                  <TableCell className="align-middle">
                    <a 
                      href={`https://wa.me/55${orc.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {formatPhoneBR(orc.telefone)}
                    </a>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge
                      variant="outline"
                      className="border-primary/40 bg-primary/5 text-primary font-medium"
                    >
                      {orc.cidade}, {orc.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{orc.media_consumo} kWh</span>
                      <span className="text-xs text-muted-foreground">
                        Geração: {orc.consumo_previsto} kWh
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <OrcamentoStatusSelector
                      orcamentoId={orc.id}
                      currentStatusId={orc.status_id}
                      statuses={statuses}
                      onStatusChange={(newStatusId) => onStatusChange(orc.id, newStatusId)}
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    {format(new Date(orc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={getWhatsAppUrl(orc.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-success hover:text-success hover:bg-success/10"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Abrir WhatsApp</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setEditOrcamento(orc);
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar lead</TooltipContent>
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

      <OrcamentoHistoryDialog
        group={selectedGroup}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        statuses={statuses}
        onViewOrcamento={(orc) => onView(orc as OrcamentoVendedor)}
        onWhatsApp={handleWhatsAppFromHistory}
        onConvertOrcamento={onConvert ? (orc) => onConvert(orc as OrcamentoVendedor) : undefined}
      />

      {/* Edit Lead Dialog */}
      {editOrcamento && (
        <LeadEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          leadId={editOrcamento.lead_id}
          initialData={{
            nome: editOrcamento.nome,
            telefone: editOrcamento.telefone,
            consultor_id: (editOrcamento as any).consultor_id || null,
            consultor_nome: editOrcamento.vendedor || null,
            cep: editOrcamento.cep,
            cidade: editOrcamento.cidade,
            estado: editOrcamento.estado,
            bairro: editOrcamento.bairro,
            rua: editOrcamento.rua,
            numero: editOrcamento.numero,
            area: editOrcamento.area,
            tipo_telhado: editOrcamento.tipo_telhado,
            rede_atendimento: editOrcamento.rede_atendimento,
            media_consumo: editOrcamento.media_consumo,
            consumo_previsto: editOrcamento.consumo_previsto,
            observacoes: editOrcamento.observacoes,
          }}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
