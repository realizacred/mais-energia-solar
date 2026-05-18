import { useState } from "react";
import { useCheques, ChequeStatus } from "@/hooks/useCheques";
import { useFinancialSettings } from "@/hooks/useFinancialSettings";
import { formatBRL } from "@/lib/formatters";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Plus, Search, Filter, Wallet, ArrowUpRight, CheckCircle2, AlertCircle, Share2 
} from "lucide-react";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { DevolverChequeDialog } from "@/components/admin/cheques/DevolverChequeDialog";

const STATUS_CONFIG: Record<ChequeStatus, { label: string, color: string, icon: any }> = {
  recebido: { label: "Recebido", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Wallet },
  em_carteira: { label: "Em Carteira", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Wallet },
  depositado: { label: "Depositado", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: ArrowUpRight },
  compensado: { label: "Compensado", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  devolvido: { label: "Devolvido", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  repassado: { label: "Repassado", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Share2 },
  sustado: { label: "Sustado", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle },
};

export default function ChequesPage() {
  const [statusFilter, setStatusFilter] = useState<ChequeStatus | 'todos'>('todos');
  const [search, setSearch] = useState("");
  const [chequeParaDevolver, setChequeParaDevolver] = useState<any>(null);
  
  const { data: settings } = useFinancialSettings();
  const { data: cheques = [], isLoading } = useCheques({ status: statusFilter });

  const filteredCheques = cheques.filter(c => 
    c.titular.toLowerCase().includes(search.toLowerCase()) ||
    c.numero_cheque.includes(search) ||
    c.clientes?.nome.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    em_carteira: cheques.filter(c => c.status === 'em_carteira' || c.status === 'recebido').reduce((acc, c) => acc + Number(c.valor), 0),
    a_compensar: cheques.filter(c => c.status === 'depositado').reduce((acc, c) => acc + Number(c.valor), 0),
    devolvidos: cheques.filter(c => c.status === 'devolvido').reduce((acc, c) => acc + Number(c.valor), 0),
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Controle de Cheques</h1>
          <p className="text-muted-foreground text-sm">Gestão e rastreabilidade de cheques recebidos</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Novo Cheque
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Carteira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(stats.em_carteira)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Compensar (Depositados)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatBRL(stats.a_compensar)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatBRL(stats.devolvidos)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por titular, número ou cliente..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Titular / Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCheques.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum cheque encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCheques.map((cheque) => {
                    const status = STATUS_CONFIG[cheque.status];
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={cheque.id}>
                        <TableCell className="font-medium">
                          {new Date(cheque.data_vencimento).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{cheque.numero_cheque}</TableCell>
                        <TableCell>{cheque.banco}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{cheque.titular}</span>
                            <span className="text-xs text-muted-foreground">Cli: {cheque.clientes?.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatBRL(cheque.valor)}
                        </TableCell>
                        <TableCell>
                          {cheque.destino || <span className="text-muted-foreground text-xs italic">Em carteira</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm">Ver</Button>
                          {!['devolvido','cancelado'].includes(cheque.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChequeParaDevolver(cheque)}
                            >
                              Devolver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {chequeParaDevolver && (
        <DevolverChequeDialog
          open={!!chequeParaDevolver}
          onOpenChange={(o) => !o && setChequeParaDevolver(null)}
          cheque={chequeParaDevolver}
        />
      )}
    </div>
  );
}
