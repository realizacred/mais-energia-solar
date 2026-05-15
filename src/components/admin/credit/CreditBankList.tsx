import { Edit, MoreHorizontal, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreditBankConfig } from "@/hooks/useCreditConfigs";

interface CreditBankListProps {
  banks: CreditBankConfig[];
  onEdit: (bank: CreditBankConfig) => void;
  onManageChecklist: (bank: CreditBankConfig) => void;
}

export function CreditBankList({ banks, onEdit, onManageChecklist }: CreditBankListProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Banco</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Prazo Médio</TableHead>
            <TableHead className="hidden lg:table-cell text-center">Documentos</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {banks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nenhum banco configurado.
              </TableCell>
            </TableRow>
          ) : (
            banks.map((bank) => (
              <TableRow key={bank.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{bank.bank_name}</span>
                    <span className="text-xs text-muted-foreground lg:hidden">
                      {bank.prazo_medio || "N/A"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {bank.is_active ? (
                    <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">
                      Inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {bank.prazo_medio || <span className="text-muted-foreground italic">Não informado</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <Badge variant="outline" className="font-mono">
                    {bank.checklist_count || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(bank)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Banco
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManageChecklist(bank)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Gerenciar Checklist
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
