import { useState } from "react";
import { Phone, Eye, MapPin, Calendar, Trash2, ShoppingCart, UserCheck, MessageSquare, RotateCcw, ScrollText } from "lucide-react";
import { useReopenLead } from "@/hooks/useReopenLead";
import { usePropostaRapidaLead } from "@/hooks/usePropostaRapidaLead";
import { DuplicateOpenDealModal } from "@/components/leads/DuplicateOpenDealModal";
import { ButtonLoader } from "@/components/loading/ButtonLoader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LeadStatusSelector } from "@/components/vendor/LeadStatusSelector";
import type { Lead, LeadStatus } from "@/types/lead";

interface VendorLeadsTableProps {
  leads: Lead[];
  statuses: LeadStatus[];
  onToggleVisto: (lead: Lead) => void;
  onView: (lead: Lead) => void;
  onStatusChange: (leadId: string, newStatusId: string | null) => void;
  onDelete?: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
}

export function VendorLeadsTable({ 
  leads, 
  statuses, 
  onToggleVisto, 
  onView,
  onStatusChange,
  onDelete,
  onConvert
}: VendorLeadsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedLeadForWhatsapp, setSelectedLeadForWhatsapp] = useState<Lead | null>(null);
  const { reopenLead, reopening } = useReopenLead();
  const {
    quickConvertToProposal,
    loading: quickLoading,
    loadingLeadId,
    duplicateGuard,
    confirmCreateAnyway,
    openExistingDeal,
    cancelDuplicateGuard,
  } = usePropostaRapidaLead();

  const handleWhatsappClick = (lead: Lead) => {
    setSelectedLeadForWhatsapp(lead);
    setWhatsappDialogOpen(true);
  };

  const handleDeleteClick = (lead: Lead) => {
    setLeadToDelete(lead);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (leadToDelete && onDelete) {
      onDelete(leadToDelete);
    }
    setDeleteDialogOpen(false);
    setLeadToDelete(null);
  };

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum lead encontrado</p>
        <p className="text-sm mt-1">
          Compartilhe seu link para começar a captar leads
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12">Visto</TableHead>
            <TableHead className="w-24">Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="hidden md:table-cell">Localização</TableHead>
            <TableHead className="hidden sm:table-cell">Consumo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            // Check if lead has been converted (status = "Convertido")
            const convertidoStatus = statuses.find(s => s.nome === "Convertido");
            const aguardandoValidacaoStatus = statuses.find(s => s.nome === "Aguardando Validação");
            const isConverted = (convertidoStatus && lead.status_id === convertidoStatus.id) || (aguardandoValidacaoStatus && lead.status_id === aguardandoValidacaoStatus.id);
            
            // Cores: borda azul = admin viu, fundo verde = vendedor marcou
            const rowClasses = [
              lead.visto_admin && "border-l-4 border-l-info",
              lead.visto && "bg-success/5",
              isConverted && "bg-primary/5",
            ].filter(Boolean).join(" ");
            
            return (
              <TableRow
                key={lead.id}
                className={`align-middle ${rowClasses}`}
              >
                <TableCell className="align-middle">
                  <Checkbox
                    checked={lead.visto}
                    onCheckedChange={() => onToggleVisto(lead)}
                    className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                  />
                </TableCell>
              <TableCell className="align-middle">
                <Badge variant="outline" className="font-mono text-xs">
                  {lead.lead_code || "-"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium align-middle">
                <div className="flex items-center gap-2">
                  {lead.nome}
                  {!lead.visto && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      Novo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="align-middle">
                <a 
                  href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary hover:underline"
                >
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {formatPhoneBR(lead.telefone)}
                </a>
              </TableCell>
              <TableCell className="hidden md:table-cell align-middle">
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {lead.cidade}, {lead.estado}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell align-middle">
                <span className="text-sm">{lead.media_consumo} kWh</span>
              </TableCell>
              <TableCell className="align-middle">
                <LeadStatusSelector
                  leadId={lead.id}
                  currentStatusId={lead.status_id}
                  statuses={statuses}
                  onStatusChange={(newStatusId) => onStatusChange(lead.id, newStatusId)}
                />
              </TableCell>
              <TableCell className="hidden lg:table-cell align-middle">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell className="text-right align-middle">
                <TooltipProvider>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-success hover:text-success hover:bg-success/10"
                          onClick={() => handleWhatsappClick(lead)}
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
                          onClick={() => onView(lead)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalhes</TooltipContent>
                    </Tooltip>
                    {!isConverted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-warning hover:text-warning hover:bg-warning/10"
                            onClick={() => quickConvertToProposal({
                              id: lead.id,
                              nome: lead.nome,
                              telefone: lead.telefone,
                              cidade: lead.cidade,
                              estado: lead.estado,
                              bairro: lead.bairro,
                              rua: lead.rua,
                              cep: lead.cep,
                              consultor_id: lead.consultor_id,
                              valor_estimado: lead.valor_estimado,
                            })}
                            disabled={quickLoading}
                          >
                            {quickLoading && loadingLeadId === lead.id ? <ButtonLoader /> : <ScrollText className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gerar Proposta Rápida</TooltipContent>
                      </Tooltip>
                    )}
                    {onConvert && !isConverted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => onConvert(lead)}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Converter em Venda</TooltipContent>
                      </Tooltip>
                    )}
                    {isConverted && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center h-8 w-8 text-success">
                              <UserCheck className="w-4 h-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Já convertido em cliente</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-warning hover:text-warning hover:bg-warning/10"
                              onClick={() => reopenLead(lead.id)}
                              disabled={reopening}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reabrir Lead</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(lead)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir lead</TooltipContent>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{leadToDelete?.nome}</strong>?
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
        lead={selectedLeadForWhatsapp}
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
      />
    </div>
  );
}
