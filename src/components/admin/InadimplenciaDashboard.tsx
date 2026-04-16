import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, Clock, DollarSign, TrendingDown, Phone, MessageCircle,
  Search, RefreshCw, Users, FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useParcelasAtrasadas, useRefreshInadimplencia } from "@/hooks/useInadimplencia";
import type { ParcelaComCliente, InadimplenciaStats } from "@/hooks/useInadimplencia";
import { PageHeader, SearchInput } from "@/components/ui-kit";
import { StatCard } from "@/components/ui-kit/StatCard";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function InadimplenciaDashboard() {
  const { data: parcelas = [], isLoading } = useParcelasAtrasadas();
  const refresh = useRefreshInadimplencia();
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
    toast({ title: "Dados atualizados!" });
  };

  const handleWhatsApp = (telefone: string, nome: string, valor: number) => {
    const phone = telefone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const message = encodeURIComponent(
      `Olá ${nome.split(" ")[0]}! Identificamos uma pendência de ${formatCurrency(valor)} em seu cadastro. Entre em contato conosco para regularizar.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  };

  const handleCall = (telefone: string) => {
    window.location.href = `tel:+55${telefone.replace(/\D/g, "")}`;
  };

  const parcelasFiltradas = useMemo(() => {
    if (!searchTerm) return parcelas;
    const term = searchTerm.toLowerCase();
    return parcelas.filter(
      (p) =>
        p.cliente_nome.toLowerCase().includes(term) ||
        p.cliente_telefone.includes(term)
    );
  }, [parcelas, searchTerm]);

  const stats: InadimplenciaStats = useMemo(() => {
    const clientesUnicos = new Set(parcelas.map((p) => p.cliente_id));
    const totalAtraso = parcelas.reduce((acc, p) => acc + p.dias_atraso, 0);
    return {
      totalAtrasadas: parcelas.length,
      valorTotalAtrasado: parcelas.reduce((acc, p) => acc + p.valor, 0),
      clientesInadimplentes: clientesUnicos.size,
      mediaAtraso: parcelas.length > 0 ? Math.round(totalAtraso / parcelas.length) : 0,
    };
  }, [parcelas]);

  const parcelasPorUrgencia = useMemo(() => ({
    criticas: parcelasFiltradas.filter((p) => p.dias_atraso > 30),
    urgentes: parcelasFiltradas.filter((p) => p.dias_atraso > 15 && p.dias_atraso <= 30),
    recentes: parcelasFiltradas.filter((p) => p.dias_atraso <= 15),
  }), [parcelasFiltradas]);

  const getUrgencyBadge = (diasAtraso: number) => {
    if (diasAtraso > 30)
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Crítico ({diasAtraso}d)</Badge>;
    if (diasAtraso > 15)
      return <Badge className="bg-warning/10 text-warning border-warning/20">Urgente ({diasAtraso}d)</Badge>;
    return <Badge variant="outline">{diasAtraso} dias</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestão de Inadimplência</h1>
            <p className="text-sm text-muted-foreground">Acompanhe e gerencie parcelas em atraso</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Parcelas Atrasadas" value={String(stats.totalAtrasadas)} color="destructive" />
        <StatCard icon={DollarSign} label="Valor em Atraso" value={formatCurrency(stats.valorTotalAtrasado)} color="destructive" />
        <StatCard icon={Users} label="Clientes Inadimplentes" value={String(stats.clientesInadimplentes)} color="warning" />
        <StatCard icon={Clock} label="Média de Atraso" value={`${stats.mediaAtraso} dias`} color="info" />
      </div>

      {/* Urgency Overview */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Distribuição por Urgência</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-destructive font-medium">Crítico (+30 dias)</span>
                <span className="text-muted-foreground">{parcelasPorUrgencia.criticas.length} parcelas</span>
              </div>
              <Progress value={(parcelasPorUrgencia.criticas.length / Math.max(parcelas.length, 1)) * 100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-warning font-medium">Urgente (15-30 dias)</span>
                <span className="text-muted-foreground">{parcelasPorUrgencia.urgentes.length} parcelas</span>
              </div>
              <Progress value={(parcelasPorUrgencia.urgentes.length / Math.max(parcelas.length, 1)) * 100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Recente (até 15 dias)</span>
                <span className="text-muted-foreground">{parcelasPorUrgencia.recentes.length} parcelas</span>
              </div>
              <Progress value={(parcelasPorUrgencia.recentes.length / Math.max(parcelas.length, 1)) * 100} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcelas Table */}
      <Card>
        <div className="p-4 border-b border-border space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Parcelas em Atraso</h3>
          <p className="text-xs text-muted-foreground">Lista completa de parcelas pendentes ordenada por urgência</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 h-9 rounded-md border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {parcelasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm font-medium">
                {parcelas.length === 0 ? "Nenhuma parcela em atraso! 🎉" : "Nenhum resultado encontrado"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                  <TableHead className="font-semibold text-foreground">Parcela</TableHead>
                  <TableHead className="font-semibold text-foreground">Valor</TableHead>
                  <TableHead className="font-semibold text-foreground">Vencimento</TableHead>
                  <TableHead className="font-semibold text-foreground">Atraso</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasFiltradas.map((parcela) => (
                  <TableRow key={parcela.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-medium text-foreground">{parcela.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{parcela.cliente_telefone}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">#{parcela.numero_parcela}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground font-mono text-sm">
                      {formatCurrency(parcela.valor)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getUrgencyBadge(parcela.dias_atraso)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleCall(parcela.cliente_telefone)} className="h-7 w-7 p-0">
                          <Phone className="h-3.5 w-3.5 text-info" />
                        </Button>
                        <Button size="sm" variant="default" onClick={() => handleWhatsApp(parcela.cliente_telefone, parcela.cliente_nome, parcela.valor)} className="h-7 w-7 p-0">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
