import { useState } from "react";
import { Phone, Eye, Trash2, ShoppingCart, UserCheck, MessageSquare, History, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { WhatsAppSendDialog } from "@/components/admin/WhatsAppSendDialog";
import { OrcamentoHistoryDialog } from "./OrcamentoHistoryDialog";
import { AssignVendorDialog } from "./AssignVendorDialog";
import { useGroupedOrcamentos, type GroupedOrcamento } from "@/hooks/useGroupedOrcamentos";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";
import type { OrcamentoSortOption } from "@/hooks/useOrcamentoSort";

interface OrcamentosTableProps {
  orcamentos: OrcamentoDisplayItem[];
  statuses?: LeadStatus[];
  sortOption?: OrcamentoSortOption;
  onToggleVisto: (orcamento: OrcamentoDisplayItem) => void;
  onView: (orcamento: OrcamentoDisplayItem) => void;
  onDelete?: (orcamento: OrcamentoDisplayItem) => void;
  onConvert?: (orcamento: OrcamentoDisplayItem) => void;
  onRefresh?: () => void;
}

export function OrcamentosTable({ 
  orcamentos, 
  statuses = [], 
  sortOption = "recent",
  onToggleVisto, 
  onView, 
  onDelete, 
  onConvert,
  onRefresh,
}: OrcamentosTableProps) {
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoDisplayItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedOrcamento | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOrcamento, setAssignOrcamento] = useState<OrcamentoDisplayItem | null>(null);

  const groupedOrcamentos = useGroupedOrcamentos(orcamentos, sortOption);

  const handleOpenWhatsApp = (orc: OrcamentoDisplayItem) => {
    setSelectedOrcamento(orc);
    setWhatsappOpen(true);
  };

  const handleOpenHistory = (group: GroupedOrcamento) => {
    setSelectedGroup(group);
    setHistoryOpen(true);
  };

  const handleWhatsAppFromHistory = (telefone: string, nome: string, leadId: string) => {
    setHistoryOpen(false);
    const orc = orcamentos.find((o) => o.lead_id === leadId);
    if (orc) {
      setSelectedOrcamento(orc);
      setWhatsappOpen(true);
    }
  };

  if (groupedOrcamentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum orçamento encontrado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Visto</TableHead>
            <TableHead className="w-28">Orçamento</TableHead>
            <TableHead className="w-24">Cliente</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Consultor</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead>Consumo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedOrcamentos.map((group) => {
            const orc = group.latestOrcamento as OrcamentoDisplayItem;
            const convertidoStatus = statuses.find(s => s.nome === "Convertido");
            const isConverted = convertidoStatus && orc.status_id === convertidoStatus.id;
            const hasHistory = group.count > 1;
            
            return (
              <TableRow
                key={group.lead_id}
                className={`${orc.visto_admin ? "bg-success/5" : ""} ${isConverted ? "bg-primary/5" : ""}`}
              >
                <TableCell>
                  <Checkbox
                    checked={orc.visto_admin}
                    onCheckedChange={() => onToggleVisto(orc)}
                    className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge variant="default" className="font-mono text-xs bg-primary">
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
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {orc.nome}
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
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    {orc.telefone}
                  </div>
                </TableCell>
                <TableCell>
                  {(orc.vendedor_nome || orc.vendedor) ? (
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20"
                      onClick={() => {
                        setAssignOrcamento(orc);
                        setAssignOpen(true);
                      }}
                    >
                      {orc.vendedor_nome || orc.vendedor}
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                      onClick={() => {
                        setAssignOrcamento(orc);
                        setAssignOpen(true);
                      }}
                    >
                      <UserPlus className="w-3 h-3" />
                      Atribuir
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="bg-secondary/10 text-secondary"
                  >
                    {orc.cidade}, {orc.estado}
                  </Badge>
                </TableCell>
                <TableCell>{orc.media_consumo} kWh</TableCell>
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
                            className="text-secondary hover:text-secondary"
                            onClick={() => onView(orc)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalhes</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleOpenWhatsApp(orc)}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enviar WhatsApp</TooltipContent>
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
                                  // Multiple orcamentos: open history to let admin pick which one
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
                            {hasHistory ? "Selecionar orçamento para venda" : "Converter em Venda"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {isConverted && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center h-8 w-8 text-emerald-600">
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
                              onClick={() => onDelete(orc)}
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

      {/* WhatsApp Dialog */}
      {selectedOrcamento && (
        <WhatsAppSendDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          telefone={selectedOrcamento.telefone}
          nome={selectedOrcamento.nome}
          leadId={selectedOrcamento.lead_id}
          tipo="lead"
        />
      )}

      {/* History Dialog */}
      <OrcamentoHistoryDialog
        group={selectedGroup}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        statuses={statuses}
        onViewOrcamento={onView}
        onWhatsApp={handleWhatsAppFromHistory}
        onConvertOrcamento={onConvert}
      />

      {/* Assign Vendor Dialog */}
      {assignOrcamento && (
        <AssignVendorDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          orcamentoId={assignOrcamento.id}
          leadId={assignOrcamento.lead_id}
          currentVendedorId={assignOrcamento.vendedor_id}
          currentVendedorNome={assignOrcamento.vendedor_nome}
          clienteNome={assignOrcamento.nome}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
