import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Filter
} from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { useComissoes, ComissaoRow } from "@/hooks/useComissoes";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfYear, endOfYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  vendedor: any;
}

export function VendorComissoesDashboard({ vendedor }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"todas" | "a_receber" | "pagas">("todas");
  
  const { data: comissoes = [], isLoading } = useComissoes({
    consultor_id: user?.id
  });

  const stats = useMemo(() => {
    const now = new Date();
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const aReceber = comissoes
      .filter(c => ["pendente", "aprovada"].includes(c.status))
      .reduce((acc, c) => acc + Number(c.valor_comissao), 0);
    
    const countAReceber = comissoes.filter(c => ["pendente", "aprovada"].includes(c.status)).length;

    const pagas = comissoes
      .filter(c => c.status === "paga")
      .reduce((acc, c) => acc + Number(c.valor_comissao), 0);
    
    const countPagas = comissoes.filter(c => c.status === "paga").length;

    const totalAno = comissoes
      .filter(c => {
        const date = parseISO(c.created_at);
        return date >= yearStart && date <= yearEnd;
      })
      .reduce((acc, c) => acc + Number(c.valor_base || 0), 0);
    
    const countVendasAno = comissoes.filter(c => {
      const date = parseISO(c.created_at);
      return date >= yearStart && date <= yearEnd;
    }).length;

    return {
      aReceber,
      countAReceber,
      pagas,
      countPagas,
      totalAno,
      countVendasAno
    };
  }, [comissoes]);

  const filteredComissoes = useMemo(() => {
    if (filter === "todas") return comissoes;
    if (filter === "a_receber") return comissoes.filter(c => ["pendente", "aprovada"].includes(c.status));
    if (filter === "pagas") return comissoes.filter(c => c.status === "paga");
    return comissoes;
  }, [comissoes, filter]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Aguardando</Badge>;
      case "aprovada":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Aprovada</Badge>;
      case "paga":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Paga</Badge>;
      case "cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">
        <Wallet className="h-4 w-4 text-primary" />
        Visão Financeira
      </div>

      {/* Row 1 — Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500/10 via-background to-background relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Clock className="h-12 w-12 text-amber-600" />
          </div>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest">A Receber</p>
                <h3 className="text-3xl font-black mt-1 text-foreground tracking-tight">{formatBRL(stats.aReceber)}</h3>
                <div className="mt-2 flex items-center gap-1.5 py-1 px-2 bg-amber-500/10 rounded-full w-fit">
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-700">{stats.countAReceber} pendentes</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-green-500/10 via-background to-background relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-green-600/80 uppercase tracking-widest">Pagas</p>
                <h3 className="text-3xl font-black mt-1 text-foreground tracking-tight">{formatBRL(stats.pagas)}</h3>
                <div className="mt-2 flex items-center gap-1.5 py-1 px-2 bg-green-500/10 rounded-full w-fit">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-[10px] font-bold text-green-700">{stats.countPagas} liquidadas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-primary/15 via-background to-background relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-12 w-12 text-primary" />
          </div>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest">Vendas do Ano</p>
                <h3 className="text-3xl font-black mt-1 text-foreground tracking-tight">{formatBRL(stats.totalAno)}</h3>
                <div className="mt-2 flex items-center gap-1.5 py-1 px-2 bg-primary/10 rounded-full w-fit">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary">{stats.countVendasAno} fechamentos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Tabela */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Histórico de Comissões
          </h4>
          <div className="flex items-center gap-2">
            <Button 
              variant={filter === "todas" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilter("todas")}
              className="h-8 text-xs"
            >
              Todas
            </Button>
            <Button 
              variant={filter === "a_receber" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilter("a_receber")}
              className="h-8 text-xs"
            >
              A Receber
            </Button>
            <Button 
              variant={filter === "pagas" ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilter("pagas")}
              className="h-8 text-xs"
            >
              Pagas
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="text-xs font-bold uppercase">Cliente</TableHead>
                <TableHead className="text-xs font-bold uppercase">Projeto</TableHead>
                <TableHead className="text-xs font-bold uppercase text-right">Valor Venda</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center">%</TableHead>
                <TableHead className="text-xs font-bold uppercase text-right">Comissão</TableHead>
                <TableHead className="text-xs font-bold uppercase text-center">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComissoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma comissão encontrada com este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filteredComissoes.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/10">
                    <TableCell className="font-medium text-sm">{item.clientes?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {item.projetos?.codigo ? (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border/50">
                          {item.projetos.codigo}
                        </code>
                      ) : (
                        item.descricao
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatBRL(item.valor_base || 0)}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{item.percentual_comissao}%</TableCell>
                    <TableCell className="text-right font-bold text-sm text-primary">{formatBRL(item.valor_comissao)}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(parseISO(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
