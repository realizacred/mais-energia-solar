import { useState } from "react";
import { Phone, Eye, Trash2, ShoppingCart, UserCheck } from "lucide-react";
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
import type { Lead, LeadStatus } from "@/types/lead";

interface LeadsTableProps {
  leads: Lead[];
  statuses?: LeadStatus[];
  onToggleVisto: (lead: Lead) => void;
  onView: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
}

export function LeadsTable({ leads, statuses = [], onToggleVisto, onView, onDelete, onConvert }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum lead encontrado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Visto</TableHead>
            <TableHead className="w-24">Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead>Consumo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            // Check if lead has been converted
            const convertidoStatus = statuses.find(s => s.nome === "Convertido");
            const isConverted = convertidoStatus && lead.status_id === convertidoStatus.id;
            
            return (
            <TableRow
              key={lead.id}
              className={`${lead.visto_admin ? "bg-green-50 dark:bg-green-950/20" : ""} ${isConverted ? "bg-primary/5" : ""}`}
            >
              <TableCell>
                <Checkbox
                  checked={lead.visto_admin}
                  onCheckedChange={() => onToggleVisto(lead)}
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {lead.lead_code || "-"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{lead.nome}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {lead.telefone}
                </div>
              </TableCell>
              <TableCell>
                {lead.vendedor ? (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    {lead.vendedor}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className="bg-secondary/10 text-secondary"
                >
                  {lead.cidade}, {lead.estado}
                </Badge>
              </TableCell>
              <TableCell>{lead.media_consumo} kWh</TableCell>
              <TableCell>
                {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
                          onClick={() => onView(lead)}
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
                            onClick={() => onConvert(lead)}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Converter em Venda</TooltipContent>
                      </Tooltip>
                    )}
                    {isConverted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center h-8 w-8 text-green-600">
                            <UserCheck className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Já convertido em cliente</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(lead)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir lead</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
