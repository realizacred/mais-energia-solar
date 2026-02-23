import { useState } from "react";
import { formatBRL } from "@/lib/formatters";
import { Phone, Eye, Trash2, ShoppingCart, UserCheck, Zap, TrendingUp, MessageSquare, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
            <TableHead>Consultor</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead>Consumo</TableHead>
            <TableHead>Geração Prevista</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Contratado</TableHead>
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
              className={`${lead.visto_admin ? "bg-success/5" : ""} ${isConverted ? "bg-primary/5" : ""}`}
            >
              <TableCell>
                <Checkbox
                  checked={lead.visto_admin}
                  onCheckedChange={() => onToggleVisto(lead)}
                  className="data-[state=checked]:bg-success data-[state=checked]:border-success"
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
                {(lead.consultor_nome || lead.consultor) ? (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    {lead.consultor_nome || lead.consultor}
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
              <TableCell>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-muted-foreground" />
                  {lead.media_consumo} kWh
                </span>
              </TableCell>
              <TableCell>
                {lead.consumo_previsto ? (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-success" />
                    <span className="font-medium text-success">{lead.consumo_previsto} kWh</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                {(() => {
                  const status = lead.wa_welcome_status || "pending";
                  if (status === "sent") {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Enviado
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Mensagem de boas-vindas enviada com sucesso</TooltipContent>
                      </Tooltip>
                    );
                  }
                  if (status === "failed") {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Falhou
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {lead.wa_welcome_error || "Falha no envio — contate por outro meio"}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  if (status === "skipped") {
                    return (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-xs gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Desativado
                      </Badge>
                    );
                  }
                  return (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs gap-1">
                      <Clock className="w-3 h-3" />
                      Pendente
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell>
                {lead.cliente_id_vinculado ? (
                  <div className="space-y-0.5">
                    {lead.cliente_potencia_kwp != null && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {lead.cliente_potencia_kwp} kWp
                      </Badge>
                    )}
                    {lead.cliente_valor_projeto != null && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                        {formatBRL(lead.cliente_valor_projeto)}
                      </Badge>
                    )}
                    {!lead.cliente_potencia_kwp && !lead.cliente_valor_projeto && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                        Sem dados
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
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
                          <span className="inline-flex items-center justify-center h-8 w-8 text-success">
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
